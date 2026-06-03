'use client';

/**
 * Inline SVG world map. Tasteful, low-detail continent silhouettes drawn in
 * `--cu` tokens — no external tiles, no network. Coordinates live in the same
 * 1000×500 equirectangular view box the pin projection uses, so silhouettes and
 * pins line up. The component renders only the basemap (ocean + land + a faint
 * graticule); pins are layered on top by the caller.
 */

import { MAP } from './tokens';
import { MAP_H, MAP_W } from './geo';

/**
 * Simplified continent outlines as SVG paths in the 1000×500 box. Hand-tuned to
 * read as the real continents at a glance without being geographically exact.
 */
const CONTINENTS: readonly string[] = [
  // North America
  'M 120 70 L 250 60 L 300 95 L 290 150 L 250 200 L 235 250 L 200 270 L 195 220 L 160 180 L 140 130 Z',
  // Central America
  'M 235 250 L 270 285 L 300 330 L 285 345 L 255 300 L 235 270 Z',
  // South America
  'M 300 330 L 345 320 L 365 360 L 360 420 L 330 470 L 305 460 L 300 400 L 285 360 Z',
  // Greenland
  'M 360 40 L 410 35 L 420 75 L 385 95 L 360 70 Z',
  // Europe
  'M 470 90 L 540 80 L 560 110 L 545 140 L 510 150 L 480 130 L 465 110 Z',
  // Africa
  'M 500 175 L 580 165 L 610 220 L 600 300 L 560 360 L 520 350 L 505 280 L 495 220 Z',
  // Asia
  'M 560 70 L 760 60 L 850 95 L 870 150 L 820 195 L 740 205 L 660 185 L 600 150 L 565 110 Z',
  // India
  'M 660 185 L 705 195 L 715 245 L 685 270 L 665 230 Z',
  // SE Asia / Indonesia
  'M 760 230 L 830 240 L 845 275 L 800 285 L 765 260 Z',
  // Australia
  'M 800 330 L 885 325 L 905 375 L 860 405 L 805 390 L 795 355 Z',
] as const;

/** Faint latitude/longitude graticule for a "map" feel. */
function Graticule() {
  const lines: React.ReactNode[] = [];
  for (let lng = 0; lng <= MAP_W; lng += MAP_W / 8) {
    lines.push(
      <line
        key={`v${lng}`}
        x1={lng}
        y1={0}
        x2={lng}
        y2={MAP_H}
        stroke={MAP.graticule}
        strokeWidth={1}
        opacity={0.25}
      />,
    );
  }
  for (let lat = 0; lat <= MAP_H; lat += MAP_H / 4) {
    lines.push(
      <line
        key={`h${lat}`}
        x1={0}
        y1={lat}
        x2={MAP_W}
        y2={lat}
        stroke={MAP.graticule}
        strokeWidth={1}
        opacity={0.25}
      />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}

export function WorldMapBase() {
  return (
    <>
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill={MAP.oceanBg} />
      <Graticule />
      <g>
        {/* CONTINENTS is a static, never-reordered module constant, so the array
            index is a safe and stable key here. */}
        {CONTINENTS.map((d, i) => (
          <path
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            d={d}
            fill={MAP.landFill}
            stroke={MAP.landStroke}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        ))}
      </g>
    </>
  );
}
