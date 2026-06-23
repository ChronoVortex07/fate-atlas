// Pure 3D geometry helpers for the astral minigame. No three.js / DOM imports —
// the component layer passes plain numbers in and reads plain results out.

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }

// World-space board radius (three.js units). The board plane is X–Z; +Y is up;
// the camera looks down −Y. "Top" of the board is −Z.
export const BOARD_RADIUS = 5;
export const CONJUNCTION_DIST = 1.4;

const TAU = Math.PI * 2;
const SECTOR = Math.PI / 6; // 30°

// House 1 is centered at the board top (−Z), houses increase clockwise.
export function sectorOf(x: number, z: number): number {
  const a = Math.atan2(x, -z);          // 0 = top, +π/2 = right (clockwise)
  const t = (a + SECTOR / 2 + TAU) % TAU; // shift so house 1 is centered on top
  return (Math.floor(t / SECTOR) % 12) + 1;
}

// Center (x,z) of a house wedge at a given radius — inverse of sectorOf's mid-angle.
export function sectorCenter(house: number, radius: number): { x: number; z: number } {
  const a = (house - 1) * SECTOR; // house 1 → a=0 (top)
  return { x: Math.sin(a) * radius, z: -Math.cos(a) * radius };
}

// Rotate a vector by a unit quaternion: v' = q * v * q⁻¹ (expanded form).
export function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3 {
  const { x, y, z } = v;
  const ix = q.w * x + q.y * z - q.z * y;
  const iy = q.w * y + q.z * x - q.x * z;
  const iz = q.w * z + q.x * y - q.y * x;
  const iw = -q.x * x - q.y * y - q.z * z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

// Index of the face whose (rotated) normal points most directly up (+Y).
export function topFaceIndex(faceNormals: Vec3[], q: Quat): number {
  let best = 0;
  let bestY = -Infinity;
  for (let i = 0; i < faceNormals.length; i++) {
    const y = rotateVec3ByQuat(faceNormals[i], q).y;
    if (y > bestY) { bestY = y; best = i; }
  }
  return best;
}

export function isErrantStar(x: number, z: number): boolean {
  return Math.hypot(x, z) > BOARD_RADIUS;
}

export function isCrownedConjunction(a: Vec3, b: Vec3): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < CONJUNCTION_DIST;
}
