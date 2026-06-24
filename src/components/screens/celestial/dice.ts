import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PlanetId, SignId } from '../../../engine/types';
import { PLANETS, SIGNS, ELEMENT_BY_SIGN } from '../../../data/astromancy';
import { topFaceIndex, type Vec3 } from '../../../engine/astralGeometry';
import { ZODIAC_ICONS, ELEMENT_COLOR, iconImage } from './icons';

// Face → id ordering. Index i of these arrays maps to face i of the geometry.
export const PLANET_FACE_IDS = Object.keys(PLANETS) as PlanetId[];     // 12
export const SIGN_FACE_IDS = Object.keys(SIGNS) as SignId[];           // 12

interface FaceData { center: Vec3; normal: Vec3 }

export interface Die {
  object: THREE.Group;
  body: CANNON.Body;
  faceData: FaceData[];        // local-space center + outward normal per face
  faceNormals: Vec3[];         // = faceData.map(f => f.normal); kept for hot paths
  faceIds: string[];
  radius: number;
  kind: 'planet' | 'sign';
}

// Cluster a DodecahedronGeometry's 36 triangles into its 12 pentagon faces by
// grouping near-parallel triangle normals. Returns { center, normal } per face.
function computeFaceData(geo: THREE.BufferGeometry): FaceData[] {
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

// Text-presentation glyph (VS-15 forces the symbol form, not the emoji form
// Windows otherwise substitutes for ♀/♂ etc.). Used for the planet die and as
// the sign-face fallback if an icon image fails to load.
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
  ctx.fillText(`${glyph}︎`, S / 2, S / 2 + 6); // VS-15 forces text (non-emoji) form
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Composite an icon image onto a face-sized canvas at the same ~62% scale the
// planet glyph uses, so the sign die reads at the same weight as the planet die.
function iconTexture(img: HTMLImageElement): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  const d = S * 0.6;
  ctx.drawImage(img, (S - d) / 2, (S - d) / 2, d, d);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Attach one outward-facing plane carrying `tex` to a die face.
function addFacePlane(die: Die, faceIndex: number, tex: THREE.Texture): void {
  const f = die.faceData[faceIndex];
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(die.radius * 0.9, die.radius * 0.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  const c = new THREE.Vector3(f.center.x, f.center.y, f.center.z);
  const n = new THREE.Vector3(f.normal.x, f.normal.y, f.normal.z);
  plane.position.copy(c).addScaledVector(n, 0.01);
  plane.lookAt(c.clone().add(n));
  die.object.add(plane);
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

  // Sphere collider (radius ≈ dodeca inradius so the snapped face sits ~flush).
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius * 0.82),
  });
  world.addBody(body);

  return {
    object, body, faceData, faceNormals: faceData.map((f) => f.normal),
    faceIds, radius, kind,
  };
}

// Planet faces: astrological glyph in gold, drawn synchronously.
export function addPlanetFaces(die: Die): void {
  die.faceIds.forEach((id, i) => {
    addFacePlane(die, i, glyphTexture(PLANETS[id as PlanetId].glyph, '#d4a854'));
  });
}

// Sign faces: gi zodiac icon tinted to the sign's element color. Async (icon
// images decode off a data URL); `isAlive` guards against the scene disposing
// mid-load so we don't add textures to a torn-down graph.
export async function addSignFaces(die: Die, isAlive: () => boolean): Promise<void> {
  const imgs = await Promise.all(
    die.faceIds.map((id) => {
      const sign = id as SignId;
      return iconImage(ZODIAC_ICONS[sign], ELEMENT_COLOR[ELEMENT_BY_SIGN[sign]]);
    }),
  );
  if (!isAlive()) return;
  die.faceIds.forEach((id, i) => {
    const sign = id as SignId;
    const color = ELEMENT_COLOR[ELEMENT_BY_SIGN[sign]];
    const img = imgs[i];
    addFacePlane(die, i, img ? iconTexture(img) : glyphTexture(SIGNS[sign].glyph, color));
  });
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
