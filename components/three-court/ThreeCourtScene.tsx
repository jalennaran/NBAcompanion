'use client';

import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';

import { CourtPlane, type CourtCanvasRenderFn, type CourtTextureInput } from './CourtPlane';
import { Hoop } from './Hoop';
import { ShotsLayer, type ArcShot, type ShotMarker } from './ShotsLayer';
import { COURT_H, COURT_W } from './coordinate';

export type ThreeCourtSceneProps = CourtTextureInput & {
  markers?: ShotMarker[];
  arcs?: ArcShot[];
  width?: number | string;
  height?: number | string;
  centerLogoUrl?: string;
  awayLogoUrl?: string;
  homeLogoUrl?: string;
};

function BroadcastCamera() {
  const { camera } = useThree();

  useEffect(() => {
    // Elevated corner/stands perspective to match arena photo style.
    camera.position.set(108, 76, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function toCanvasX(xFeet: number, widthPx: number): number {
  return ((xFeet + COURT_W / 2) / COURT_W) * widthPx;
}

function toCanvasY(zFeet: number, heightPx: number): number {
  return ((zFeet + COURT_H / 2) / COURT_H) * heightPx;
}

/* ── Logo image loader ── */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function drawCourtLines(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number): void {
  const white = '#ffffff';
  const pxPerFoot = widthPx / COURT_W; // same as heightPx / COURT_H by aspect-ratio
  const lw = Math.max(2, widthPx * 0.003);

  ctx.strokeStyle = white;
  ctx.lineWidth = lw;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 1;

  /* ── Court boundary ── */
  ctx.strokeRect(lw / 2, lw / 2, widthPx - lw, heightPx - lw);

  /* ── Half-court line ── */
  const midY = heightPx / 2;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(widthPx, midY);
  ctx.stroke();

  /* ── Center circle (6′ radius) ── */
  ctx.beginPath();
  ctx.arc(widthPx / 2, midY, 6 * pxPerFoot, 0, Math.PI * 2);
  ctx.stroke();

  /* ── Inner center circle (2′ radius) ── */
  ctx.beginPath();
  ctx.arc(widthPx / 2, midY, 2 * pxPerFoot, 0, Math.PI * 2);
  ctx.stroke();

  /* ── Hoop positions (center of basket) ── */
  const hoopNearZ = -COURT_H / 2 + 5.25;
  const hoopFarZ = COURT_H / 2 - 5.25;

  /* ── Paint / Key — 16′ wide × 19′ deep ── */
  const laneHW = 8;
  const laneDepth = 19;
  const nearLaneEnd = -COURT_H / 2 + laneDepth;
  const farLaneStart = COURT_H / 2 - laneDepth;

  // Paint fill
  ctx.fillStyle = 'rgba(180, 40, 40, 0.2)';
  ctx.fillRect(
    toCanvasX(-laneHW, widthPx),
    toCanvasY(-COURT_H / 2, heightPx),
    laneHW * 2 * pxPerFoot,
    laneDepth * pxPerFoot,
  );
  ctx.fillRect(
    toCanvasX(-laneHW, widthPx),
    toCanvasY(farLaneStart, heightPx),
    laneHW * 2 * pxPerFoot,
    laneDepth * pxPerFoot,
  );

  // Paint outlines
  ctx.strokeStyle = white;
  ctx.strokeRect(
    toCanvasX(-laneHW, widthPx),
    toCanvasY(-COURT_H / 2, heightPx),
    laneHW * 2 * pxPerFoot,
    laneDepth * pxPerFoot,
  );
  ctx.strokeRect(
    toCanvasX(-laneHW, widthPx),
    toCanvasY(farLaneStart, heightPx),
    laneHW * 2 * pxPerFoot,
    laneDepth * pxPerFoot,
  );

  /* ── Free-throw circles (6′ radius) — solid half toward mid-court, dashed half toward baseline ── */
  const dashLen = Math.max(4, widthPx * 0.006);

  // Near: solid bottom half (toward mid-court)
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(nearLaneEnd, heightPx), 6 * pxPerFoot, 0, Math.PI);
  ctx.stroke();
  // Near: dashed top half (toward baseline)
  ctx.save();
  ctx.setLineDash([dashLen, dashLen]);
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(nearLaneEnd, heightPx), 6 * pxPerFoot, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // Far: solid top half (toward mid-court)
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(farLaneStart, heightPx), 6 * pxPerFoot, Math.PI, 2 * Math.PI);
  ctx.stroke();
  // Far: dashed bottom half (toward baseline)
  ctx.save();
  ctx.setLineDash([dashLen, dashLen]);
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(farLaneStart, heightPx), 6 * pxPerFoot, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  /* ── Lane hash marks (blocks) at 7, 8, 11, 14 ft from baseline ── */
  const blockDists = [7, 8, 11, 14];
  const blockLen = 0.5; // 6″ outward
  ctx.strokeStyle = white;
  ctx.lineWidth = lw;

  for (const d of blockDists) {
    for (const sign of [-1, 1]) {
      // Near end
      const nearBlockZ = -COURT_H / 2 + d;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(sign * laneHW, widthPx), toCanvasY(nearBlockZ, heightPx));
      ctx.lineTo(toCanvasX(sign * (laneHW + blockLen), widthPx), toCanvasY(nearBlockZ, heightPx));
      ctx.stroke();
      // Far end
      const farBlockZ = COURT_H / 2 - d;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(sign * laneHW, widthPx), toCanvasY(farBlockZ, heightPx));
      ctx.lineTo(toCanvasX(sign * (laneHW + blockLen), widthPx), toCanvasY(farBlockZ, heightPx));
      ctx.stroke();
    }
  }

  /* ── Restricted-area arcs (4′ radius) + straight lines to backboard face ── */
  const restrictedR = 4 * pxPerFoot;
  const bbFaceNearZ = -COURT_H / 2 + 4;
  const bbFaceFarZ = COURT_H / 2 - 4;

  ctx.strokeStyle = white;
  ctx.lineWidth = lw;

  // Near: bottom semicircle (curving toward mid-court)
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(hoopNearZ, heightPx), restrictedR, 0, Math.PI, false);
  ctx.stroke();
  // Near: straight lines from arc ends back to backboard face
  ctx.beginPath();
  ctx.moveTo(toCanvasX(-4, widthPx), toCanvasY(hoopNearZ, heightPx));
  ctx.lineTo(toCanvasX(-4, widthPx), toCanvasY(bbFaceNearZ, heightPx));
  ctx.moveTo(toCanvasX(4, widthPx), toCanvasY(hoopNearZ, heightPx));
  ctx.lineTo(toCanvasX(4, widthPx), toCanvasY(bbFaceNearZ, heightPx));
  ctx.stroke();

  // Far: top semicircle (curving toward mid-court)
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(hoopFarZ, heightPx), restrictedR, Math.PI, 2 * Math.PI, false);
  ctx.stroke();
  // Far: straight lines from arc ends back to backboard face
  ctx.beginPath();
  ctx.moveTo(toCanvasX(-4, widthPx), toCanvasY(hoopFarZ, heightPx));
  ctx.lineTo(toCanvasX(-4, widthPx), toCanvasY(bbFaceFarZ, heightPx));
  ctx.moveTo(toCanvasX(4, widthPx), toCanvasY(hoopFarZ, heightPx));
  ctx.lineTo(toCanvasX(4, widthPx), toCanvasY(bbFaceFarZ, heightPx));
  ctx.stroke();

  /* ── Three-point lines ── */
  const cornerX = 22;
  const threeR = 23.75;
  const alpha = Math.acos(cornerX / threeR);
  const nearArcZ = hoopNearZ + Math.sqrt(threeR * threeR - cornerX * cornerX);
  const farArcZ = hoopFarZ - Math.sqrt(threeR * threeR - cornerX * cornerX);

  // Near corner straight segments
  ctx.beginPath();
  ctx.moveTo(toCanvasX(-cornerX, widthPx), toCanvasY(-COURT_H / 2, heightPx));
  ctx.lineTo(toCanvasX(-cornerX, widthPx), toCanvasY(nearArcZ, heightPx));
  ctx.moveTo(toCanvasX(cornerX, widthPx), toCanvasY(-COURT_H / 2, heightPx));
  ctx.lineTo(toCanvasX(cornerX, widthPx), toCanvasY(nearArcZ, heightPx));
  ctx.stroke();

  // Near three-point arc (clockwise = curving toward mid-court)
  ctx.beginPath();
  ctx.arc(
    toCanvasX(0, widthPx),
    toCanvasY(hoopNearZ, heightPx),
    threeR * pxPerFoot,
    alpha,
    Math.PI - alpha,
    false,
  );
  ctx.stroke();

  // Far corner straight segments
  ctx.beginPath();
  ctx.moveTo(toCanvasX(-cornerX, widthPx), toCanvasY(COURT_H / 2, heightPx));
  ctx.lineTo(toCanvasX(-cornerX, widthPx), toCanvasY(farArcZ, heightPx));
  ctx.moveTo(toCanvasX(cornerX, widthPx), toCanvasY(COURT_H / 2, heightPx));
  ctx.lineTo(toCanvasX(cornerX, widthPx), toCanvasY(farArcZ, heightPx));
  ctx.stroke();

  // Far three-point arc (clockwise = curving toward mid-court)
  ctx.beginPath();
  ctx.arc(
    toCanvasX(0, widthPx),
    toCanvasY(hoopFarZ, heightPx),
    threeR * pxPerFoot,
    Math.PI + alpha,
    2 * Math.PI - alpha,
    false,
  );
  ctx.stroke();

  /* ── Backboard indicators on floor ── */
  ctx.lineWidth = Math.max(3, widthPx * 0.004);
  ctx.strokeStyle = white;
  ctx.beginPath();
  ctx.moveTo(toCanvasX(-3, widthPx), toCanvasY(bbFaceNearZ, heightPx));
  ctx.lineTo(toCanvasX(3, widthPx), toCanvasY(bbFaceNearZ, heightPx));
  ctx.moveTo(toCanvasX(-3, widthPx), toCanvasY(bbFaceFarZ, heightPx));
  ctx.lineTo(toCanvasX(3, widthPx), toCanvasY(bbFaceFarZ, heightPx));
  ctx.stroke();

  /* ── Hoop circles on floor ── */
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = Math.max(2, widthPx * 0.003);
  const hoopR = 0.75 * pxPerFoot;
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(hoopNearZ, heightPx), hoopR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(toCanvasX(0, widthPx), toCanvasY(hoopFarZ, heightPx), hoopR, 0, Math.PI * 2);
  ctx.stroke();
}

type CourtRenderOptions = {
  centerLogoUrl?: string;
  awayLogoUrl?: string;
  homeLogoUrl?: string;
};

function createDefaultCourtRenderFn(options?: CourtRenderOptions): CourtCanvasRenderFn {
  return async (ctx, widthPx, heightPx) => {
    const pxPerFoot = widthPx / COURT_W;

    /* ── Wood floor background ── */
    const wood = ctx.createLinearGradient(0, 0, widthPx, 0);
    wood.addColorStop(0, '#d7bc95');
    wood.addColorStop(0.5, '#ceb086');
    wood.addColorStop(1, '#d8be97');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, widthPx, heightPx);

    /* ── Hardwood stripe pattern ── */
    const stripeW = Math.max(10, Math.floor(widthPx / 42));
    for (let x = 0; x < widthPx; x += stripeW) {
      ctx.fillStyle = x / stripeW % 2 === 0 ? 'rgba(99, 66, 40, 0.07)' : 'rgba(99, 66, 40, 0.02)';
      ctx.fillRect(x, 0, stripeW, heightPx);
    }

    /* ── Draw logos BEFORE court lines (lines should be on top) ── */
    const logoEntries: { url: string; key: string }[] = [];
    if (options?.centerLogoUrl) logoEntries.push({ url: options.centerLogoUrl, key: 'center' });
    if (options?.awayLogoUrl) logoEntries.push({ url: options.awayLogoUrl, key: 'away' });
    if (options?.homeLogoUrl) logoEntries.push({ url: options.homeLogoUrl, key: 'home' });

    if (logoEntries.length > 0) {
      const results = await Promise.allSettled(
        logoEntries.map(async (entry) => ({
          key: entry.key,
          img: await loadImage(entry.url),
        })),
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { key, img } = result.value;

        ctx.save();

        if (key === 'center') {
          /* Center court logo — sized to fill center circle area (6 ft radius) */
          const logoDiameter = 12 * pxPerFoot;
          const cx = widthPx / 2;
          const cy = heightPx / 2;

          /* Clip to center circle so logo doesn't bleed outside */
          ctx.beginPath();
          ctx.arc(cx, cy, 6 * pxPerFoot, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          ctx.globalAlpha = 0.55;
          const aspect = img.naturalWidth / img.naturalHeight;
          let drawW = logoDiameter;
          let drawH = logoDiameter;
          if (aspect > 1) {
            drawH = drawW / aspect;
          } else {
            drawW = drawH * aspect;
          }
          ctx.translate(cx, cy);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else if (key === 'away') {
          /* Away team — near baseline paint area */
          const logoSize = 8 * pxPerFoot;
          const cx = widthPx / 2;
          const cy = toCanvasY(-COURT_H / 2 + 10, heightPx);
          ctx.globalAlpha = 0.35;
          const aspect = img.naturalWidth / img.naturalHeight;
          let drawW = logoSize;
          let drawH = logoSize;
          if (aspect > 1) drawH = drawW / aspect;
          else drawW = drawH * aspect;
          ctx.translate(cx, cy);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else if (key === 'home') {
          /* Home team — far baseline paint area */
          const logoSize = 8 * pxPerFoot;
          const cx = widthPx / 2;
          const cy = toCanvasY(COURT_H / 2 - 10, heightPx);
          ctx.globalAlpha = 0.35;
          const aspect = img.naturalWidth / img.naturalHeight;
          let drawW = logoSize;
          let drawH = logoSize;
          if (aspect > 1) drawH = drawW / aspect;
          else drawW = drawH * aspect;
          ctx.translate(cx, cy);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }

        ctx.restore();
      }
    }

    /* ── Court lines (drawn on top) ── */
    drawCourtLines(ctx, widthPx, heightPx);
  };
}

const RIM_HEIGHT = 10;

/* Exact basket UV positions: 5.25 ft from each baseline */
const NEAR_BASKET_V = 5.25 / 94;
const FAR_BASKET_V = 1 - 5.25 / 94;

const DEMO_ARCS: ArcShot[] = [
  {
    id: 'arc-1',
    startUV: [0.18, 0.2],
    endUV: [0.5, NEAR_BASKET_V],
    durationMs: 1100,
    startDelayMs: 0,
    apex: 12,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#f08c00',
    trailColor: '#ffd43b',
  },
  {
    id: 'arc-2',
    startUV: [0.82, 0.22],
    endUV: [0.5, NEAR_BASKET_V],
    durationMs: 1000,
    startDelayMs: 1250,
    apex: 13,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#e03131',
    trailColor: '#ffa8a8',
  },
  {
    id: 'arc-3',
    startUV: [0.5, 0.78],
    endUV: [0.5, FAR_BASKET_V],
    durationMs: 1200,
    startDelayMs: 2450,
    apex: 10,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#1864ab',
    trailColor: '#74c0fc',
  },
];

const DEMO_MARKERS: ShotMarker[] = [
  { id: 'm-1', u: 0.18, v: 0.2, color: '#087f5b' },
  { id: 'm-2', u: 0.82, v: 0.22, color: '#087f5b' },
  { id: 'm-3', u: 0.5, v: 0.78, color: '#087f5b' },
  { id: 'm-4', u: 0.5, v: NEAR_BASKET_V, color: '#c92a2a' },
  { id: 'm-5', u: 0.5, v: FAR_BASKET_V, color: '#c92a2a' },
];

export function ThreeCourtScene({
  markers,
  arcs,
  width = '100%',
  height = 560,
  centerLogoUrl,
  awayLogoUrl,
  homeLogoUrl,
  courtTextureUrl,
  courtSvgString,
  courtSvgElement,
  renderFn,
  widthPx,
  heightPx,
}: ThreeCourtSceneProps) {
  const resolvedMarkers = useMemo(() => markers ?? DEMO_MARKERS, [markers]);
  const resolvedArcs = useMemo(() => arcs ?? DEMO_ARCS, [arcs]);
  const fallbackRenderFn = useMemo(
    () => createDefaultCourtRenderFn({
      centerLogoUrl,
      awayLogoUrl,
      homeLogoUrl,
    }),
    [centerLogoUrl, awayLogoUrl, homeLogoUrl],
  );
  const hasExternalTextureInput = Boolean(courtTextureUrl || courtSvgString || courtSvgElement || renderFn);
  const resolvedTextureProps = hasExternalTextureInput
    ? { courtTextureUrl, courtSvgString, courtSvgElement, renderFn, widthPx, heightPx }
    : { renderFn: fallbackRenderFn, widthPx: 1200, heightPx: 2256 };

  return (
    <div style={{ width, height }}>
      <Canvas dpr={[1, 2]} camera={{ position: [118, 76, 18], fov: 26, near: 0.1, far: 600 }}>
        <BroadcastCamera />

        <ambientLight intensity={0.85} />
        <directionalLight position={[90, 120, 30]} intensity={0.65} />

        <CourtPlane {...resolvedTextureProps} />

        <Hoop baselineZ={-COURT_H / 2} direction={1} />
        <Hoop baselineZ={COURT_H / 2} direction={-1} />

        <ShotsLayer markers={resolvedMarkers} arcs={resolvedArcs} />
      </Canvas>
    </div>
  );
}
