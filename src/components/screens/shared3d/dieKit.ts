import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { topFaceIndex, type Vec3 } from '../../../engine/astralGeometry';

export interface FaceData { center: Vec3; normal: Vec3 }

export interface DieLike {
  object: THREE.Group;
  body: CANNON.Body;
  faceData: FaceData[];
  faceNormals: Vec3[];
  faceIds: string[];
  radius: number;
}

// Cluster a geometry's triangles into faces by grouping near-parallel triangle
// normals (default dot > 0.95). Returns { center, normal } per face — works for
// any convex die geometry (dodecahedron → 12, icosahedron → 20, tetrahedron → 4).
export function computeFaceData(geo: THREE.BufferGeometry, parallelDot = 0.95): FaceData[] {
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
    let f = faces.find((g) => new THREE.Vector3(g.normal.x, g.normal.y, g.normal.z).dot(t.n) > parallelDot);
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
  return faces.map((f) => ({ center: f.center, normal: f.normal }));
}

// Text-presentation glyph (VS-15 forces the symbol form, not the emoji form).
export function glyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  ctx.font = `${S * 0.62}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${glyph}︎`, S / 2, S / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Attach one outward-facing plane carrying `tex` to a die face.
export function addFacePlane(object: THREE.Group, face: FaceData, radius: number, tex: THREE.Texture): void {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 0.9, radius * 0.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  const c = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
  const n = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z);
  plane.position.copy(c).addScaledVector(n, 0.01);
  plane.lookAt(c.clone().add(n));
  object.add(plane);
}

export function faceIndexOfId(die: { faceIds: string[] }, id: string): number {
  return Math.max(0, die.faceIds.indexOf(id));
}

export function readTopFace(die: DieLike): string {
  const q = die.body.quaternion;
  const idx = topFaceIndex(die.faceNormals, { x: q.x, y: q.y, z: q.z, w: q.w });
  return die.faceIds[idx];
}

// Orient the die so the given face points exactly up (+Y); zero its velocities.
export function snapToFace(die: DieLike, faceIndex: number): void {
  const n = die.faceNormals[faceIndex];
  const from = new THREE.Vector3(n.x, n.y, n.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(from, up);
  die.body.quaternion.set(q.x, q.y, q.z, q.w);
  die.body.angularVelocity.set(0, 0, 0);
  die.body.velocity.set(0, 0, 0);
  die.object.quaternion.copy(q);
}
