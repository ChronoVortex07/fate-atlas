import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PlanetId, SignId } from '../../../engine/types';
import { PLANETS, SIGNS } from '../../../data/astromancy';
import { topFaceIndex, type Vec3 } from '../../../engine/astralGeometry';

// Face → id ordering. Index i of these arrays maps to face i of the geometry.
export const PLANET_FACE_IDS = Object.keys(PLANETS) as PlanetId[];     // 12
export const SIGN_FACE_IDS = Object.keys(SIGNS) as SignId[];           // 12

export interface Die {
  object: THREE.Group;
  body: CANNON.Body;
  faceNormals: Vec3[]; // local-space outward normal per face (index = face id index)
  faceIds: string[];
  kind: 'planet' | 'sign';
}

// Cluster a DodecahedronGeometry's 36 triangles into its 12 pentagon faces by
// grouping near-parallel triangle normals. Returns { center, normal } per face.
function computeFaceData(geo: THREE.BufferGeometry): { center: Vec3; normal: Vec3 }[] {
  const pos = geo.getAttribute('position');
  const tris: { c: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    tris.push({ c: center, n });
  }
  const faces: { center: Vec3; normal: Vec3; _ns: THREE.Vector3[]; _cs: THREE.Vector3[] }[] = [];
  for (const t of tris) {
    let f = faces.find((g) => g.normal && new THREE.Vector3(g.normal.x, g.normal.y, g.normal.z).dot(t.n) > 0.95);
    if (!f) {
      f = { center: { x: 0, y: 0, z: 0 }, normal: { x: t.n.x, y: t.n.y, z: t.n.z }, _ns: [], _cs: [] };
      faces.push(f);
    }
    f._ns.push(t.n); f._cs.push(t.c);
  }
  for (const f of faces) {
    const n = new THREE.Vector3();
    f._ns.forEach((v) => n.add(v));
    n.normalize();
    const cen = new THREE.Vector3();
    f._cs.forEach((v) => cen.add(v));
    cen.multiplyScalar(1 / f._cs.length);
    f.normal = { x: n.x, y: n.y, z: n.z };
    f.center = { x: cen.x, y: cen.y, z: cen.z };
  }
  return faces.map((f) => ({ center: f.center, normal: f.normal })); // expect length 12
}

function glyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  ctx.font = `${S * 0.62}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, S / 2, S / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDie(
  kind: 'planet' | 'sign',
  world: CANNON.World,
  faceIds: string[],
  radius: number,
): Die {
  const object = new THREE.Group();

  // Visual dodecahedron body.
  const geo = new THREE.DodecahedronGeometry(radius);
  const bodyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x141c33, roughness: 0.5, metalness: 0.35 }),
  );
  bodyMesh.castShadow = true;
  object.add(bodyMesh);

  const faceData = computeFaceData(geo);
  const glyphColor = kind === 'planet' ? '#d4a854' : '#9bc4e2';

  // One glyph plane per face, positioned just outside the face, facing outward.
  faceData.forEach((f, i) => {
    const id = faceIds[i];
    const glyph = kind === 'planet' ? PLANETS[id as PlanetId].glyph : SIGNS[id as SignId].glyph;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 0.9, radius * 0.9),
      new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, glyphColor), transparent: true, depthWrite: false }),
    );
    const c = new THREE.Vector3(f.center.x, f.center.y, f.center.z);
    const n = new THREE.Vector3(f.normal.x, f.normal.y, f.normal.z);
    plane.position.copy(c).addScaledVector(n, 0.01);
    plane.lookAt(c.clone().add(n));
    object.add(plane);
  });

  // Sphere collider (radius ≈ dodeca inradius so the snapped face sits ~flush).
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius * 0.82),
  });
  world.addBody(body);

  return {
    object,
    body,
    faceNormals: faceData.map((f) => f.normal),
    faceIds,
    kind,
  };
}

export function faceIndexOfId(die: Die, id: string): number {
  return Math.max(0, die.faceIds.indexOf(id));
}

export function readTopFace(die: Die): string {
  const q = die.body.quaternion;
  const idx = topFaceIndex(die.faceNormals, { x: q.x, y: q.y, z: q.z, w: q.w });
  return die.faceIds[idx];
}

// Orient the die so that the given face points exactly up (+Y), then sync mesh.
export function snapToFace(die: Die, faceIndex: number): void {
  const n = die.faceNormals[faceIndex];
  const from = new THREE.Vector3(n.x, n.y, n.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(from, up);
  die.body.quaternion.set(q.x, q.y, q.z, q.w);
  die.body.angularVelocity.set(0, 0, 0);
  die.body.velocity.set(0, 0, 0);
  die.object.quaternion.copy(q);
}
