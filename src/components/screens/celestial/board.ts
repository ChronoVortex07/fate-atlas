import * as THREE from 'three';
import type { SignId } from '../../../engine/types';
import { NATURAL_ZODIAC_BY_HOUSE, ELEMENT_BY_SIGN, SIGNS, HOUSES } from '../../../data/astromancy';
import { BOARD_RADIUS } from '../../../engine/astralGeometry';
import { SIGN_ART } from './signArt';

const TEX = 1024;              // texture resolution
const C = TEX / 2;             // canvas center
const R = TEX * 0.46;          // board radius in texture px
const SECTOR = Math.PI / 6;

const ELEMENT_TINT: Record<'fire' | 'earth' | 'air' | 'water', string> = {
  fire:  'rgba(180, 70, 45, 0.40)',
  earth: 'rgba(90, 110, 70, 0.38)',
  air:   'rgba(150, 160, 120, 0.34)',
  water: 'rgba(60, 110, 165, 0.40)',
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fallback path handles null
    img.src = url;
  });
}

// Draw one wedge: dark base, element tint, darkened sign art (or glyph fallback),
// spokes, and the house number/arena label near the rim.
function drawWedge(
  ctx: CanvasRenderingContext2D,
  house: number,
  sign: SignId,
  art: HTMLImageElement | null,
) {
  const a0 = (house - 1) * SECTOR - SECTOR / 2 - Math.PI / 2; // canvas: -π/2 = top
  const a1 = a0 + SECTOR;
  const mid = a0 + SECTOR / 2;
  const element = ELEMENT_BY_SIGN[sign];

  ctx.save();
  // Clip to the wedge.
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.arc(C, C, R, a0, a1);
  ctx.closePath();
  ctx.clip();

  // Base fill.
  ctx.fillStyle = '#0b0f1c';
  ctx.fillRect(0, 0, TEX, TEX);

  // Element tint wash.
  ctx.fillStyle = ELEMENT_TINT[element];
  ctx.fillRect(0, 0, TEX, TEX);

  // Sign art (darkened) centered in the wedge, or glyph fallback.
  const ax = C + Math.cos(mid) * R * 0.6;
  const ay = C + Math.sin(mid) * R * 0.6;
  const size = R * 0.42;
  if (art) {
    ctx.globalAlpha = 0.32; // darkened for clarity
    ctx.drawImage(art, ax - size / 2, ay - size / 2, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(212, 168, 84, 0.30)';
    ctx.font = `${size}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGNS[sign].glyph, ax, ay);
  }
  ctx.restore();

  // Spoke line on the wedge's leading edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 168, 84, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(a0) * R, C + Math.sin(a0) * R);
  ctx.stroke();
  ctx.restore();

  // House number + arena near the rim.
  ctx.save();
  ctx.translate(C + Math.cos(mid) * R * 0.9, C + Math.sin(mid) * R * 0.9);
  ctx.rotate(mid + Math.PI / 2);
  ctx.fillStyle = 'rgba(212, 168, 84, 0.7)';
  ctx.textAlign = 'center';
  ctx.font = '34px "Cormorant Garamond", serif';
  ctx.fillText(String(house), 0, -14);
  ctx.font = '18px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(123, 158, 199, 0.7)';
  ctx.fillText(HOUSES[house - 1].arena, 0, 10);
  ctx.restore();
}

async function buildBoardTexture(): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;

  // Deep background disc.
  ctx.fillStyle = '#070a14';
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.fill();

  // Preload art for all houses' natural signs (null on failure → glyph fallback).
  const arts = await Promise.all(
    NATURAL_ZODIAC_BY_HOUSE.map((s) => loadImage(SIGN_ART[s])),
  );

  for (let h = 1; h <= 12; h++) {
    drawWedge(ctx, h, NATURAL_ZODIAC_BY_HOUSE[h - 1], arts[h - 1]);
  }

  // Outer rim.
  ctx.strokeStyle = 'rgba(212, 168, 84, 0.85)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.stroke();

  // Center sigil.
  ctx.fillStyle = 'rgba(212, 168, 84, 0.18)';
  ctx.font = '70px "Cormorant Garamond", serif';
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
    new THREE.CircleGeometry(BOARD_RADIUS, 96),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 }),
  );
  disc.rotation.x = -Math.PI / 2; // lay flat in X–Z, face up
  disc.receiveShadow = true;
  group.add(disc);

  // Raised gold rim torus.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_RADIUS, 0.12, 16, 96),
    new THREE.MeshStandardMaterial({ color: 0xd4a854, roughness: 0.4, metalness: 0.8 }),
  );
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);

  return group;
}
