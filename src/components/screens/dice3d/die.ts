import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  computeFaceData, glyphTexture, addFacePlane, snapToFace, readTopFace, faceIndexOfId,
  type DieLike,
} from '../shared3d/dieKit';

export { snapToFace, readTopFace, faceIndexOfId };

export interface DiceDie extends DieLike { kind: 'd20' | 'd4'; tint: string }

const DIE_COLOR = 0x141c33;

// Build a die from a convex geometry whose faces are numbered 1..N.
function buildDie(
  kind: 'd20' | 'd4',
  geo: THREE.BufferGeometry,
  world: CANNON.World,
  radius: number,
  tint: string,
  colliderScale: number,
): DiceDie {
  const object = new THREE.Group();
  const bodyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: DIE_COLOR, roughness: 0.5, metalness: 0.35 }),
  );
  bodyMesh.castShadow = true;
  object.add(bodyMesh);

  const faceData = computeFaceData(geo);
  const faceIds = faceData.map((_, i) => String(i + 1)); // face index i → number i+1
  faceData.forEach((f, i) => addFacePlane(object, f, radius, glyphTexture(faceIds[i], tint)));

  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius * colliderScale) });
  world.addBody(body);

  return { object, body, faceData, faceNormals: faceData.map((f) => f.normal), faceIds, radius, kind, tint };
}

// d20: icosahedron (20 triangular faces). Gold numerals. Sphere collider sized so
// the snapped face sits ~flush (same approach as the astral d12).
export function createD20(world: CANNON.World, radius: number): DiceDie {
  return buildDie('d20', new THREE.IcosahedronGeometry(radius), world, radius, '#d4a854', 0.86);
}

// d4: tetrahedron (4 faces). Tinted gold (Bless) or red (Bane) by the caller.
export function createD4(world: CANNON.World, radius: number, tint: string): DiceDie {
  return buildDie('d4', new THREE.TetrahedronGeometry(radius), world, radius, tint, 0.62);
}
