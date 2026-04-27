'use client';

import { useEffect, useState } from 'react';
import type { Play } from '@/lib/types';

// CourtStrip SVG viewBox is "0 0 94 50" (landscape — court length × court width)
// Away basket at (5.25, 25), Home basket at (88.75, 25)
// ESPN normalises every shot to the attacking end:
//   espnX  0–50  court width  → SVG y
//   espnY  0–35  dist from basket → SVG x offset from basket

const INT_SENTINEL = -214748000;

function isValidESPNCoord(coord?: { x: number; y: number }): boolean {
  return (
    !!coord &&
    coord.x > INT_SENTINEL &&
    coord.x >= 0 && coord.x <= 50 &&
    coord.y >= 0 && coord.y <= 35
  );
}

function isFreeThrow(p: Play): boolean {
  return /free.?throw/i.test(p.type?.text ?? '');
}

const AT_BASKET_COORD = { x: 25, y: 0 };

/** ESPN shot coord → CourtStrip SVG [x, y] */
function espnToSvg(espnX: number, espnY: number, isHome: boolean): [number, number] {
  const svgY = Math.max(0.5, Math.min(49.5, espnX));
  const svgX = isHome
    ? 88.75 - Math.max(0, espnY)
    : 5.25 + Math.max(0, espnY);
  return [svgX, svgY];
}

/** Maps a normalised density t ∈ [0,1] to an RGBA tuple. */
function heatColor(t: number): [number, number, number, number] {
  if (t <= 0.03) return [0, 0, 0, 0];
  const a = Math.min(215, Math.round(t * 255));
  let r, g, b;
  if (t < 0.25) {
    const s = t / 0.25;
    r = 0; g = Math.round(s * 150); b = 220;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = 0; g = 150 + Math.round(s * 105); b = Math.round((1 - s) * 220);
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = Math.round(s * 255); g = 255; b = 0;
  } else {
    const s = (t - 0.75) / 0.25;
    r = 255; g = 255 - Math.round(s * 220); b = 0;
  }
  return [r, g, b, a];
}

function buildDensity(shots: Array<[number, number]>, W: number, H: number, SIGMA: number): Float32Array {
  const density = new Float32Array(W * H);
  for (const [sx, sy] of shots) {
    const px = sx * (W / 94);
    const py = sy * (H / 50);
    const radius = Math.ceil(3 * SIGMA);
    const x0 = Math.max(0, Math.floor(px - radius));
    const x1 = Math.min(W - 1, Math.ceil(px + radius));
    const y0 = Math.max(0, Math.floor(py - radius));
    const y1 = Math.min(H - 1, Math.ceil(py + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - px) ** 2 + (y - py) ** 2;
        density[y * W + x] += Math.exp(-d2 / (2 * SIGMA * SIGMA));
      }
    }
  }
  return density;
}

function renderDensityToCanvas(
  ctx: CanvasRenderingContext2D,
  density: Float32Array,
  W: number,
  H: number,
): void {
  let maxD = 0;
  for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];
  if (maxD === 0) return;

  const imgData = ctx.createImageData(W, H);
  for (let i = 0; i < density.length; i++) {
    const t = Math.sqrt(density[i] / maxD);
    const [r, g, b, alpha] = heatColor(t);
    imgData.data[i * 4] = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = alpha;
  }
  ctx.putImageData(imgData, 0, 0);
}

function buildDataUrl(shots: Array<[number, number]>): string | null {
  return buildDataUrlMulti([shots]);
}

/** Renders multiple shot groups each with independent normalization, then composites them. */
function buildDataUrlMulti(shotGroups: Array<Array<[number, number]>>): string | null {
  if (shotGroups.every((g) => g.length === 0)) return null;

  const SVG_W = 94;
  const SVG_H = 50;
  const SCALE = 10;
  const W = SVG_W * SCALE;
  const H = SVG_H * SCALE;
  const SIGMA = 4.5 * SCALE;

  // Render each group to its own canvas with independent normalization
  const groupCanvases = shotGroups
    .filter((g) => g.length > 0)
    .map((shots) => {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const density = buildDensity(shots, W, H, SIGMA);
      renderDensityToCanvas(ctx, density, W, H);
      return canvas;
    })
    .filter(Boolean) as HTMLCanvasElement[];

  if (groupCanvases.length === 0) return null;

  // Composite all groups onto a single canvas
  const composite = document.createElement('canvas');
  composite.width = W;
  composite.height = H;
  const cCtx = composite.getContext('2d')!;
  for (const gc of groupCanvases) {
    cCtx.drawImage(gc, 0, 0);
  }

  // Light blur for a smoother look
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = W;
  blurCanvas.height = H;
  const bCtx = blurCanvas.getContext('2d')!;
  bCtx.filter = 'blur(5px)';
  bCtx.drawImage(composite, 0, 0);

  return blurCanvas.toDataURL('image/png');
}

export type HeatmapTeamFilter = 'away' | 'both' | 'home';

type Props = {
  plays: Play[];
  homeTeamId: string;
  teamFilter: HeatmapTeamFilter;
};

export function ShotHeatmapLayer({ plays, homeTeamId, teamFilter }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const homeShots: Array<[number, number]> = [];
    const awayShots: Array<[number, number]> = [];

    for (const p of plays) {
      if (!p.shootingPlay || isFreeThrow(p)) continue;

      const isHome = p.team?.id === homeTeamId;
      if (teamFilter === 'home' && !isHome) continue;
      if (teamFilter === 'away' && isHome) continue;

      const coord = isValidESPNCoord(p.coordinate)
        ? p.coordinate!
        : AT_BASKET_COORD;

      const svgCoord = espnToSvg(coord.x, coord.y, isHome);
      if (isHome) homeShots.push(svgCoord);
      else awayShots.push(svgCoord);
    }

    // Use independent normalization per team so neither team's density scale
    // is skewed by the other team's shot volume.
    if (teamFilter === 'both') {
      setDataUrl(buildDataUrlMulti([awayShots, homeShots]));
    } else {
      const shots = teamFilter === 'home' ? homeShots : awayShots;
      setDataUrl(buildDataUrl(shots));
    }
  }, [plays, homeTeamId, teamFilter]);

  if (!dataUrl) return null;

  return (
    <image
      href={dataUrl}
      x="0"
      y="0"
      width="94"
      height="50"
      preserveAspectRatio="none"
      style={{ opacity: 0.82 }}
    />
  );
}
