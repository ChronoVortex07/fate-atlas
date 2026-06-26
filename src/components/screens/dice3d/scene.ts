import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { RollMode } from '../../../engine/types';
import { castTuning } from '../../../engine/astralPhysics';
import { BOARD_RADIUS, WALL_RADIUS } from '../../../engine/astralGeometry';
import { createD20, createD4, snapToFace, readTopFace, faceIndexOfId, type DiceDie } from './die';

const DIE_R = 0.6;
const D4_R = 0.4;
const SETTLE_FRAMES = 22;
const SAFETY_CAP = 900;
const CAM_TILT = new THREE.Vector3(0, 9.5, 13);
const CAM_TOP = new THREE.Vector3(0, 18, 0.001);

export interface FlickVector { vx: number; vz: number; power: number }

export interface DiceSceneController {
  rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void;
  rollModifiers(blessValues: number[], baneValues: number[]): void;
  dispose(): void;
}

export function createDiceScene(opts: {
  canvas: HTMLCanvasElement;
  affinities: Record<string, number>;
  onResolved: (keptD20: number) => void;
  onChoiceReady: (values: [number, number]) => void;
  onModifiersResolved: () => void;
}): DiceSceneController {
  const { canvas, affinities, onResolved, onChoiceReady, onModifiersResolved } = opts;
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
  const key = new THREE.DirectionalLight(0xffe6b0, 1.15);
  key.position.set(4, 12, 6);
  key.castShadow = true;
  scene.add(key);

  // ── Bowl: floor + circular wall (24-gon of inward planes), reused pattern ──
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  const floorMat = new CANNON.Material('floor');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, {
    restitution: tuning.restitution, friction: 0.35,
  }));
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
    wall.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(-Math.cos(a), 0, -Math.sin(a)));
    wall.position.set(Math.cos(a) * WALL_RADIUS, 0, Math.sin(a) * WALL_RADIUS);
    world.addBody(wall);
  }

  // Visual bowl disc.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b0f1c, roughness: 0.9, metalness: 0.1 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_RADIUS, 0.12, 16, 80),
    new THREE.MeshStandardMaterial({ color: 0xd4a854, roughness: 0.4, metalness: 0.8 }),
  );
  rim.rotation.x = -Math.PI / 2;
  scene.add(rim);

  // ── Dice ──
  const d20a = mkDie(createD20(world, DIE_R));
  const d20b = mkDie(createD20(world, DIE_R));
  const blessDice: DiceDie[] = [];
  const baneDice: DiceDie[] = [];

  function mkDie(d: DiceDie): DiceDie {
    d.body.material = dieMat;
    d.body.linearDamping = tuning.linearDamping;
    d.body.angularDamping = tuning.angularDamping;
    scene.add(d.object);
    return d;
  }
  const parkY = -10;
  const park = (d: DiceDie) => { d.body.position.set(0, parkY, 0); d.body.velocity.set(0, 0, 0); d.object.visible = false; };
  [d20a, d20b].forEach(park);

  // ── State machine ──
  type Phase = 'idle' | 'rolling' | 'smashing' | 'mods-rolling' | 'done';
  let phase: Phase = 'idle';
  let raf = 0, still = 0, ticks = 0;
  let mode: RollMode = 'single';
  let targets: number[] = [];
  let active: DiceDie[] = [];        // the d20(s) in play this throw
  let kept: DiceDie | null = null;
  let smashT = 0; const smashFrom = new THREE.Vector3(); const smashOver = new THREE.Vector3();

  const syncMesh = (d: DiceDie) => {
    d.object.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    const q = d.body.quaternion;
    d.object.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const throwDie = (d: DiceDie, dx: number, flick?: FlickVector) => {
    d.object.visible = true;
    d.body.position.set(dx, 6 + Math.random() * 1.2, BOARD_RADIUS * 0.45);
    const s = tuning.scatter;
    const fx = flick ? flick.vx * (1 + flick.power) : (Math.random() - 0.5) * 3 * s;
    const fz = flick ? -2 - flick.power * 4 : -3 - Math.random() * 2 * s;
    d.body.velocity.set(fx, -2 - Math.random() * 2, fz);
    d.body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    d.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  };

  const energy = (ds: DiceDie[]) =>
    ds.reduce((e, d) => e + d.body.velocity.length() + d.body.angularVelocity.length(), 0);

  // Snap each active d20 to its target face, then pick the kept die per mode.
  const settleThrow = () => {
    active.forEach((d, i) => snapToFace(d, faceIndexOfId(d, String(targets[i]))));
    active.forEach(syncMesh);

    if (mode === 'single') {
      kept = active[0];
      phase = 'done';
      onResolved(targets[0]);
      return;
    }
    if (mode === 'choice') {
      phase = 'done';
      onChoiceReady([targets[0], targets[1]]);
      return;
    }
    // advantage / disadvantage: choose kept, begin the smash.
    const keepFirst = mode === 'advantage' ? targets[0] >= targets[1] : targets[0] <= targets[1];
    kept = keepFirst ? active[0] : active[1];
    const loser = keepFirst ? active[1] : active[0];
    smashOver.set(loser.body.position.x, DIE_R, loser.body.position.z);
    smashFrom.copy(kept.object.position);
    smashT = 0;
    kept.body.type = CANNON.Body.KINEMATIC;
    kept.body.velocity.set(0, 0, 0);
    kept.body.angularVelocity.set(0, 0, 0);
    (kept as DiceDie & { _loser?: DiceDie })._loser = loser;
    phase = 'smashing';
  };

  // Kinematic lift → hover over loser → smash down; eject the loser on impact.
  const stepSmash = () => {
    if (!kept) return;
    smashT += 1 / 38; // ~0.6s arc
    const t = Math.min(1, smashT);
    const loser = (kept as DiceDie & { _loser?: DiceDie })._loser!;
    // up-and-over for the first 60%, slam down for the last 40%.
    const apex = new THREE.Vector3(smashOver.x, DIE_R + 3, smashOver.z);
    if (t < 0.6) {
      const u = t / 0.6;
      kept.body.position.set(
        smashFrom.x + (apex.x - smashFrom.x) * u,
        smashFrom.y + (apex.y - smashFrom.y) * u,
        smashFrom.z + (apex.z - smashFrom.z) * u,
      );
    } else {
      const u = (t - 0.6) / 0.4;
      kept.body.position.set(apex.x, apex.y + (DIE_R - apex.y) * u, apex.z);
      if (u >= 1 && loser.body.type !== CANNON.Body.KINEMATIC) {
        // Impact: eject the loser outward + up, then it sinks away.
        const dir = new THREE.Vector3(loser.body.position.x, 0, loser.body.position.z).normalize();
        loser.body.velocity.set(dir.x * 7 + 2, 6, dir.z * 7 + 2);
        loser.body.angularVelocity.set(8, 8, 8);
      }
    }
    syncMesh(kept); syncMesh(loser);
    if (t >= 1) {
      kept.body.type = CANNON.Body.DYNAMIC;
      kept.body.position.set(0, DIE_R, 0);
      kept.body.velocity.set(0, 0, 0);
      snapToFace(kept, faceIndexOfId(kept, String(readTopFaceValue(kept))));
      syncMesh(kept);
      loser.object.visible = false;
      const keptValue = readTopFaceValue(kept);
      phase = 'done';
      onResolved(keptValue);
    }
  };

  const readTopFaceValue = (d: DiceDie) => Number(readTopFace(d));

  // Drop the physical Bless/Bane d4s in to their values.
  const startModifiers = (blessValues: number[], baneValues: number[]) => {
    const make = (vals: number[], tint: string, arr: DiceDie[], sideSign: number) => {
      vals.forEach((v, i) => {
        const d = mkDie(createD4(world, D4_R, tint));
        arr.push(d);
        d.object.visible = true;
        d.body.position.set(sideSign * (1.2 + i * 0.6), 5 + i, BOARD_RADIUS * 0.3);
        d.body.velocity.set(sideSign * -1, -3, -2);
        d.body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        // stash the intended value on the die for the settle snap.
        (d as DiceDie & { _val?: number })._val = v;
      });
    };
    make(blessValues, '#d4a854', blessDice, -1);
    make(baneValues, '#c0392b', baneDice, 1);
    still = 0; ticks = 0;
    phase = 'mods-rolling';
  };

  const settleModifiers = () => {
    [...blessDice, ...baneDice].forEach((d) => {
      const v = (d as DiceDie & { _val?: number })._val ?? 1;
      snapToFace(d, faceIndexOfId(d, String(v)));
      syncMesh(d);
    });
    phase = 'done';
    onModifiersResolved();
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (phase === 'rolling') {
      ticks++;
      world.fixedStep();
      active.forEach(syncMesh);
      still = energy(active) < 0.4 ? still + 1 : 0;
      const t = Math.min(1, ticks / 80);
      camera.position.lerpVectors(CAM_TILT, CAM_TOP, t * t);
      camera.lookAt(0, 0, 0);
      if (still > SETTLE_FRAMES || ticks >= SAFETY_CAP) settleThrow();
    } else if (phase === 'smashing') {
      world.fixedStep();
      stepSmash();
    } else if (phase === 'mods-rolling') {
      ticks++;
      world.fixedStep();
      [...blessDice, ...baneDice].forEach(syncMesh);
      still = energy([...blessDice, ...baneDice]) < 0.4 ? still + 1 : 0;
      if (still > SETTLE_FRAMES || ticks >= SAFETY_CAP) settleModifiers();
    } else {
      camera.position.lerp(CAM_TOP, 0.08);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const onResize = () => { const s = size(); renderer.setSize(s, s, false); };
  window.addEventListener('resize', onResize);

  return {
    rollCheck(t: number[], m: RollMode, flick?: FlickVector) {
      mode = m; targets = t;
      active = m === 'single' ? [d20a] : [d20a, d20b];
      kept = null; still = 0; ticks = 0;
      active.forEach((d, i) => throwDie(d, (i === 0 ? -1 : 1) * DIE_R * 1.6, flick));
      phase = 'rolling';
    },
    rollModifiers(blessValues: number[], baneValues: number[]) {
      if (blessValues.length === 0 && baneValues.length === 0) { onModifiersResolved(); return; }
      startModifiers(blessValues, baneValues);
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (material) {
          const mats = Array.isArray(material) ? material : [material];
          for (const mm of mats) {
            const map = (mm as THREE.MeshStandardMaterial).map;
            if (map) map.dispose();
            mm.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
