// Zodiac iconography for the 3D astral minigame. This is the single source of
// sign glyphs for both the board wedges and the sign die — Game-Icons (gi) set
// via react-icons, rasterized to colored images so three.js can texture them.
//
// Component layer only: it imports react / react-dom / react-icons. The engine
// stays framework-free.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IconType } from 'react-icons';
import {
  GiAries, GiTaurus, GiGemini, GiCancer, GiLeo, GiVirgo,
  GiLibra, GiScorpio, GiSagittarius, GiCapricorn, GiAquarius, GiPisces,
} from 'react-icons/gi';
import type { SignId } from '../../../engine/types';
import type { SignDef } from '../../../data/astromancy';

export const ZODIAC_ICONS: Record<SignId, IconType> = {
  aries: GiAries, taurus: GiTaurus, gemini: GiGemini, cancer: GiCancer,
  leo: GiLeo, virgo: GiVirgo, libra: GiLibra, scorpio: GiScorpio,
  sagittarius: GiSagittarius, capricorn: GiCapricorn, aquarius: GiAquarius, pisces: GiPisces,
};

// Bright element colors, tuned to read against the dark navy board.
export const ELEMENT_COLOR: Record<SignDef['element'], string> = {
  fire:  '#ff7a59',
  earth: '#86d98a',
  air:   '#ffd98a',
  water: '#6db8ff',
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // callers fall back to a text glyph
    img.src = url;
  });
}

// Rasterize a gi glyph to a colored HTMLImageElement (256² → power-of-two).
// The serialized <svg> carries an inline `color`, which its `currentColor`
// fills resolve to when the data-URL is decoded as a standalone image.
export function iconImage(Icon: IconType, color: string): Promise<HTMLImageElement | null> {
  const svg = renderToStaticMarkup(createElement(Icon, { color, size: 256 }));
  return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}
