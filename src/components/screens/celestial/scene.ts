import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { AstralCast, OmenTag, PlanetId, SignId } from '../../../engine/types';
import { castTuning } from '../../../engine/astralPhysics';
import {
  sectorOf, sectorCenter, isErrantStar, isCrownedConjunction, BOARD_RADIUS,
} from '../../../engine/astralGeometry';
import { createBoard } from './board';
import {
  createDie, readTopFace, faceIndexOfId, snapToFace,
  PLANET_FACE_IDS, SIGN_FACE_IDS, type Die,
} from './dice';

const DIE_R = 0.55;
const SETTLE_FRAMES = 35;      // frames of near-stillness before settling
const SETTLE_TICK_CAP = 600;   // hard timeout → veiled-oracle
const CAM_TILT = new THREE.Vector3(0, 7, 9);     // during roll
const CAM_TOP = new THREE.Vector3(0, 14, 0.001); // settled

export interface CelestialSceneController {
  roll(target: AstralCast | null): void;
  dispose(): void;
}

export function createCelestialScene(opts: {
  canvas: HTMLCanvasElement;
  affinities: Record<string, number>;
  onSettled: (cast: AstralCast) => void;
}): CelestialSceneController {
  const { canvas, affinities, onSettled } = opts;
  const tuning = castTuning(affinities);

  // ── Renderer / scene / camera ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const size = () => Math.min(canvas.clientWidth || 420, 480);
  renderer.setSize(size(), size(), false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(CAM_TILT);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x6b7fb0, 0.7));
  const key = new THREE.DirectionalLight(0xffe6b0, 1.1);
  key.position.set(4, 12, 6);
  key.castShadow = true;
  scene.add(key);

  // ── Physics world ──
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  const floorMat = new CANNON.Material('floor');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, {
    restitution: tuning.restitution, friction: 0.35,
  }));
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  // ── Dice ──
  const planet = createDie('planet', world, PLANET_FACE_IDS, DIE_R);
  const sign = createDie('sign', world, SIGN_FACE_IDS, DIE_R);
  [planet, sign].forEach((d) => {
    d.body.material = dieMat;
    d.body.linearDamping = tuning.linearDamping;
    d.body.angularDamping = tuning.angularDamping;
    scene.add(d.object);
  });

  // Board (async). Dice rest off-board until the texture is ready / a roll starts.
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  let boardReady = false;
  createBoard().then((g) => { boardGroup.add(g); boardReady = true; });

  const restPose = (d: Die, x: number) => {
    d.body.position.set(x, DIE_R, BOARD_RADIUS * 0.62);
    d.body.velocity.set(0, 0, 0);
    d.body.angularVelocity.set(0, 0, 0);
    d.body.quaternion.set(0, 0, 0, 1);
  };
  restPose(planet, -DIE_R * 1.4);
  restPose(sign, DIE_R * 1.4);

  // ── State ──
  type Phase = 'idle' | 'rolling' | 'done';
  let phase: Phase = 'idle';
  let still = 0, ticks = 0, raf = 0;
  let target: AstralCast | null = null;
  let settledFired = false;

  const throwDie = (d: Die, dx: number) => {
    d.body.position.set(dx, 6 + Math.random() * 1.5, BOARD_RADIUS * 0.35 + Math.random());
    const s = tuning.scatter;
    d.body.velocity.set((Math.random() - 0.5) * 3 * s, -2 - Math.random() * 2, -3 - Math.random() * 2 * s);
    d.body.angularVelocity.set(
      (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
    );
    d.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  };

  const applyForces = () => {
    for (const d of [planet, sign]) {
      const p = d.body.position;
      // Gentle radial centering (the weakened vortex).
      d.body.applyForce(new CANNON.Vec3(-p.x * tuning.centering, 0, -p.z * tuning.centering), p);
      // Lateral light/shadow drift.
      if (tuning.lateralBias) d.body.applyForce(new CANNON.Vec3(tuning.lateralBias, 0, 0), p);
      // Chaos turbulence.
      if (tuning.turbulence && ticks % 8 === 0) {
        d.body.applyForce(new CANNON.Vec3(
          (Math.random() - 0.5) * tuning.turbulence * 6, 0, (Math.random() - 0.5) * tuning.turbulence * 6,
        ), p);
      }
    }
  };

  const syncMesh = (d: Die) => {
    d.object.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    const q = d.body.quaternion;
    d.object.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const settle = () => {
    if (settledFired) return;
    settledFired = true;
    phase = 'done';

    // Snap each die flat (to target face if provided, else to up-most face).
    if (target) {
      snapToFace(planet, faceIndexOfId(planet, target.planet));
      snapToFace(sign, faceIndexOfId(sign, target.sign));
      const pc = sectorCenter(target.planetHouse, BOARD_RADIUS * 0.55);
      const sc = sectorCenter(target.signHouse, BOARD_RADIUS * 0.55);
      planet.body.position.set(pc.x, DIE_R, pc.z);
      sign.body.position.set(sc.x, DIE_R, sc.z);
    } else {
      // Snap to whatever face is currently up.
      const pIdx = planet.faceIds.indexOf(readTopFace(planet));
      const sIdx = sign.faceIds.indexOf(readTopFace(sign));
      snapToFace(planet, pIdx);
      snapToFace(sign, sIdx);
    }
    syncMesh(planet); syncMesh(sign);

    const pPos = planet.body.position, sPos = sign.body.position;
    const omens: OmenTag[] = [];
    if (isErrantStar(pPos.x, pPos.z) || isErrantStar(sPos.x, sPos.z)) omens.push('errant-star');
    if (isCrownedConjunction(
      { x: pPos.x, y: pPos.y, z: pPos.z }, { x: sPos.x, y: sPos.y, z: sPos.z },
    )) omens.push('crowned-conjunction');
    if (ticks >= SETTLE_TICK_CAP) omens.push('veiled-oracle');

    const cast: AstralCast = target ?? {
      planet: readTopFace(planet) as PlanetId,
      sign: readTopFace(sign) as SignId,
      planetHouse: sectorOf(pPos.x, pPos.z),
      signHouse: sectorOf(sPos.x, sPos.z),
      omens,
    };
    // When target-driven, still attach physically-derived omens.
    if (target) cast.omens = omens;

    onSettled(cast);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);

    if (phase === 'rolling') {
      ticks++;
      applyForces();
      world.fixedStep();
      syncMesh(planet); syncMesh(sign);

      const speed = planet.body.velocity.length() + sign.body.velocity.length()
        + planet.body.angularVelocity.length() + sign.body.angularVelocity.length();
      still = speed < 0.4 ? still + 1 : 0;

      // Camera ease tilt → top-down across the roll.
      const t = Math.min(1, ticks / 90);
      camera.position.lerpVectors(CAM_TILT, CAM_TOP, t * t);
      camera.lookAt(0, 0, 0);

      if (still > SETTLE_FRAMES || ticks >= SETTLE_TICK_CAP) settle();
    } else if (phase === 'idle') {
      boardGroup.rotation.y += 0.0015; // ambient life
      syncMesh(planet); syncMesh(sign);
    } else {
      // done: hold top-down
      camera.position.lerp(CAM_TOP, 0.1);
      camera.lookAt(0, 0, 0);
    }

    if (boardReady || phase !== 'idle') renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const onResize = () => { const s = size(); renderer.setSize(s, s, false); };
  window.addEventListener('resize', onResize);

  return {
    roll(t: AstralCast | null) {
      target = t;
      settledFired = false;
      still = 0; ticks = 0;
      boardGroup.rotation.y = 0;
      phase = 'rolling';
      throwDie(planet, -DIE_R * 1.4);
      throwDie(sign, DIE_R * 1.4);
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
