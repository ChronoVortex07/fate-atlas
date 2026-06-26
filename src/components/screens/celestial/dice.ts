import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PlanetId, SignId } from '../../../engine/types';
import { PLANETS, SIGNS, ELEMENT_BY_SIGN } from '../../../data/astromancy';
import { ZODIAC_ICONS, ELEMENT_COLOR, iconImage } from './icons';
import {
  computeFaceData, glyphTexture, addFacePlane, faceIndexOfId, readTopFace, snapToFace,
  type DieLike,
} from '../shared3d/dieKit';

// Face → id ordering. Index i of these arrays maps to face i of the geometry.
export const PLANET_FACE_IDS = Object.keys(PLANETS) as PlanetId[];     // 12
export const SIGN_FACE_IDS = Object.keys(SIGNS) as SignId[];           // 12

export interface Die extends DieLike { kind: 'planet' | 'sign' }

// Re-export the helpers scene.ts imports from here so scene.ts needs no edit.
export { faceIndexOfId, readTopFace, snapToFace };

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
    addFacePlane(die.object, die.faceData[i], die.radius, glyphTexture(PLANETS[id as PlanetId].glyph, '#d4a854'));
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
    addFacePlane(die.object, die.faceData[i], die.radius, img ? iconTexture(img) : glyphTexture(SIGNS[sign].glyph, color));
  });
}
