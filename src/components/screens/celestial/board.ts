import * as THREE from 'three';
import type { SignId } from '../../../engine/types';
import { NATURAL_ZODIAC_BY_HOUSE, ELEMENT_BY_SIGN, SIGNS } from '../../../data/astromancy';
import { BOARD_RADIUS, WALL_RADIUS } from '../../../engine/astralGeometry';
import { ZODIAC_ICONS, ELEMENT_COLOR, iconImage } from './icons';
import { ZODIAC_CONSTELLATIONS, type ZodiacConstellation } from './constellationArt';

const TEX = 1024;              // texture resolution
const C = TEX / 2;             // canvas center
const R = TEX * 0.47;          // outer (wall) radius in texture px → WALL_RADIUS
const SECTOR = Math.PI / 6;

// Radial bands, as fractions of the outer radius R.
const F_PLAY = BOARD_RADIUS / WALL_RADIUS; // out-of-bounds threshold / inner edge of the outer ring
const R_PLAY = R * F_PLAY;
const R_NAME_IN = R_PLAY - R * 0.055;      // inner edge of the name divider band
const R_NAME = (R_NAME_IN + R_PLAY) / 2;   // name baseline radius
const R_ICON = R_NAME_IN - R * 0.055;      // small sign icon, just inside the name band
// Constellations are deliberately distorted to fill the tall, narrow wedge: the
// radial axis is stretched far more than the tangential one.
const RC = R * 0.47;          // constellation center radius
const CON_SX = R * 0.066;     // tangential half-extent (fits the wedge width)
const CON_SY = R * 0.20;      // radial half-extent (stretched to fill the space)

const GOLD = '212, 168, 84';
const STAR = '255, 255, 255';
const LINE = '226, 238, 255';

function drawConstellation(ctx: CanvasRenderingContext2D, data: ZodiacConstellation) {
  // Crisp connecting lines.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${LINE}, 0.5)`;
  ctx.beginPath();
  for (const [a, b] of data.lines) {
    const s = data.stars[a], e = data.stars[b];
    ctx.moveTo(s[0] * CON_SX, s[1] * CON_SY);
    ctx.lineTo(e[0] * CON_SX, e[1] * CON_SY);
  }
  ctx.stroke();

  // White stars — crisp dots with only a faint halo (the board, not these, carries the glow).
  for (const [x, y, b] of data.stars) {
    const px = x * CON_SX, py = y * CON_SY;
    const core = 1.9 + b * 1.5;
    const halo = ctx.createRadialGradient(px, py, 0, px, py, core * 1.9);
    halo.addColorStop(0, `rgba(${STAR}, ${0.2 * b})`);
    halo.addColorStop(1, `rgba(${STAR}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(px, py, core * 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${STAR}, ${Math.min(1, 0.85 * b + 0.2)})`;
    ctx.beginPath(); ctx.arc(px, py, core, 0, Math.PI * 2); ctx.fill();
  }
}

// Draw a CAPS label curved along the arc, centered on midAngle, tops facing the rim.
function arcText(ctx: CanvasRenderingContext2D, text: string, radius: number, midAngle: number) {
  const fontPx = R * 0.044;
  ctx.font = `600 ${fontPx}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${GOLD}, 0.95)`;
  const step = (fontPx * 0.62) / radius; // angular advance per char
  const start = midAngle - ((text.length - 1) / 2) * step;
  for (let i = 0; i < text.length; i++) {
    const a = start + i * step;
    ctx.save();
    ctx.translate(C + Math.cos(a) * radius, C + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
}

function drawWedge(
  ctx: CanvasRenderingContext2D,
  house: number,
  sign: SignId,
  art: HTMLImageElement | null,
) {
  const a0 = (house - 1) * SECTOR - SECTOR / 2 - Math.PI / 2; // canvas: -π/2 = top
  const mid = a0 + SECTOR / 2;
  const color = ELEMENT_COLOR[ELEMENT_BY_SIGN[sign]];

  // Constellation, clipped to the wedge so stray stars never spill into a neighbour.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.arc(C, C, R_NAME_IN, a0, a0 + SECTOR);
  ctx.closePath();
  ctx.clip();
  ctx.translate(C + Math.cos(mid) * RC, C + Math.sin(mid) * RC);
  ctx.rotate(mid + Math.PI / 2);
  drawConstellation(ctx, ZODIAC_CONSTELLATIONS[sign]);
  ctx.restore();

  // Small element-colored sign icon near the outer edge, facing outward.
  const ax = C + Math.cos(mid) * R_ICON;
  const ay = C + Math.sin(mid) * R_ICON;
  const size = R * 0.092;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(mid + Math.PI / 2);
  if (art) {
    ctx.drawImage(art, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${SIGNS[sign].glyph}︎`, 0, 0);
  }
  ctx.restore();

  // Name in the divider band.
  arcText(ctx, SIGNS[sign].name.toUpperCase(), R_NAME, mid);

  // Spoke line on the wedge's leading edge (inner disc only).
  ctx.save();
  ctx.strokeStyle = `rgba(${GOLD}, 0.16)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(a0) * R_NAME_IN, C + Math.sin(a0) * R_NAME_IN);
  ctx.stroke();
  ctx.restore();
}

// The astrolabe-style outer ring (out-of-bounds band): ticks, star studs, rails.
function drawOuterRing(ctx: CanvasRenderingContext2D) {
  // Band fill.
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.arc(C, C, R_PLAY, 0, Math.PI * 2, true);
  ctx.fillStyle = '#0a1322';
  ctx.fill('evenodd');
  ctx.restore();

  // Degree ticks: minor every 6°, major (longer, brighter) at the 12 boundaries.
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const r0 = major ? R_PLAY : R * 0.875;
    const r1 = R * 0.965;
    ctx.strokeStyle = `rgba(${GOLD}, ${major ? 0.6 : 0.28})`;
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    ctx.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Tiny star studs centered between boundaries.
  for (let h = 0; h < 12; h++) {
    const a = h * SECTOR - Math.PI / 2;
    const px = C + Math.cos(a) * R * 0.92;
    const py = C + Math.sin(a) * R * 0.92;
    ctx.fillStyle = `rgba(${GOLD}, 0.75)`;
    ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  // Rails bracketing the band + the name divider.
  for (const [rad, alpha, w] of [[R_NAME_IN, 0.5, 1.5], [R_PLAY, 0.85, 2.5], [R, 0.85, 3]] as const) {
    ctx.strokeStyle = `rgba(${GOLD}, ${alpha})`;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(C, C, rad, 0, Math.PI * 2); ctx.stroke();
  }
}

async function buildBoardTexture(): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;

  // Backing disc out to the wall.
  ctx.fillStyle = '#060b16';
  ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();

  // Blue interior (the playfield), lighter at center → deeper at the edge.
  const blue = ctx.createRadialGradient(C, C, 0, C, C, R_PLAY);
  blue.addColorStop(0, '#123a63');
  blue.addColorStop(0.65, '#0d2747');
  blue.addColorStop(1, '#081a31');
  ctx.fillStyle = blue;
  ctx.beginPath(); ctx.arc(C, C, R_PLAY, 0, Math.PI * 2); ctx.fill();

  // Preload each house's natural-sign icon in its element color.
  const arts = await Promise.all(
    NATURAL_ZODIAC_BY_HOUSE.map((s) => iconImage(ZODIAC_ICONS[s], ELEMENT_COLOR[ELEMENT_BY_SIGN[s]])),
  );

  for (let h = 1; h <= 12; h++) {
    drawWedge(ctx, h, NATURAL_ZODIAC_BY_HOUSE[h - 1], arts[h - 1]);
  }

  drawOuterRing(ctx);

  // Center sigil.
  ctx.fillStyle = `rgba(${GOLD}, 0.22)`;
  ctx.font = `${R * 0.13}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', C, C);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export async function createBoard(): Promise<THREE.Group> {
  const group = new THREE.Group();

  const tex = await buildBoardTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(WALL_RADIUS, 96),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 }),
  );
  disc.rotation.x = -Math.PI / 2; // lay flat in X–Z, face up
  disc.receiveShadow = true;
  group.add(disc);

  // Raised gold rim torus at the wall.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(WALL_RADIUS, 0.12, 16, 120),
    new THREE.MeshStandardMaterial({ color: 0xd4a854, roughness: 0.4, metalness: 0.8 }),
  );
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);

  return group;
}
