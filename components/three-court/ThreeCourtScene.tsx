'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';

import { CourtPlane, type CourtCanvasRenderFn, type CourtTextureInput } from './CourtPlane';
import { Hoop } from './Hoop';
import { ShotsLayer, type ArcShot, type ShotMarker } from './ShotsLayer';
import { COURT_H, COURT_W } from './coordinate';
import type { Play } from '../../lib/types';

export type ThreeCourtSceneProps = CourtTextureInput & {
  markers?: ShotMarker[];
  arcs?: ArcShot[];
  width?: number | string;
  height?: number | string;
  centerLogoUrl?: string;
  awayLogoUrl?: string;
  homeLogoUrl?: string;
  /** ESPN play-by-play array — drives shot markers and arc animations */
  plays?: Play[];
  /** ESPN team id for the home team */
  homeTeamId?: string;
  /** Hex color string (without #) for home team */
  homeColor?: string;
  /** Hex color string (without #) for away team */
  awayColor?: string;
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

/* ── ESPN coordinate helpers ── */
const INT_SENTINEL = -214748000;

function isValidESPNCoord(coord?: { x: number; y: number }): boolean {
  // x: court width 0–50 ft; y: distance from the attacking basket 0–35 ft
  // (ESPN normalises all shots to the offensive end; heaves > 35 ft are filtered out)
  return (
    !!coord &&
    coord.x > INT_SENTINEL &&
    coord.x >= 0 && coord.x <= COURT_W &&
    coord.y >= 0 && coord.y <= 35
  );
}

/**
 * Converts an ESPN shot coordinate to UV on our court plane.
 * ESPN gives x (0-50, court width) and y (distance in feet FROM the attacking
 * basket/hoop, normalised to the offensive end).  Because the hoop is 5.25 ft
 * from the baseline we add that offset before normalising to [0..1] so that a
 * 24-ft three-pointer lands beyond the 3-pt arc rather than in mid-range.
 *
 * Convention: away team attacks the NEAR basket (v ≈ 0), home attacks FAR (v ≈ 1).
 */
function espnToUV(
  espnX: number,
  espnY: number,
  attackFar: boolean,
): [number, number] {
  // clamp x to [0.5, 49.5] so corner shots stay just inside the sideline
  const clampedX = Math.max(0.5, Math.min(COURT_W - 0.5, espnX));
  // clamp y to [0, 32] — anything beyond half-court is a heave, discard via filter
  const clampedY = Math.max(0, espnY);
  const u = clampedX / COURT_W;
  // ESPN y is distance FROM THE HOOP (not from the baseline). The hoop is 5.25 ft
  // from the baseline, so we add that offset before normalising to [0..1].
  const rawV = (clampedY + 5.25) / COURT_H;
  const v = attackFar ? 1 - rawV : rawV;
  // ensure UV stays within [0.01, 0.99] so markers always sit on the floor mesh
  return [
    Math.max(0.01, Math.min(0.99, u)),
    Math.max(0.01, Math.min(0.99, v)),
  ];
}

/** Returns true when the play is a free-throw attempt. */
function isFreeThrow(p: Play): boolean {
  return /free.?throw/i.test(p.type?.text ?? '');
}

/**
 * Synthetic coordinate for any free throw: horizontally centred (x = 25),
 * 13.75 ft from the hoop (= 19-ft lane depth − 5.25-ft hoop offset).
 */
const FT_COORD = { x: COURT_W / 2, y: 13.75 } as const;

/**
 * Fallback coordinate for shooting plays with no ESPN coordinate
 * (dunks, tip-ins, put-backs at the basket): place directly under the hoop.
 */
const AT_BASKET_COORD = { x: COURT_W / 2, y: 0 } as const;

/** Stable pseudo-random deflection sign/magnitude from a play id string */
function stableDeflect(id: string): number {
  const n = parseInt(id.slice(-5), 10) || 0;
  const mag = 1.5 + (n % 30) / 10; // 1.5 – 4.5 ft
  return n % 2 === 0 ? mag : -mag;
}

type ShotItem = { arc: ArcShot; marker: ShotMarker };

/** Converts every shooting play into its arc + marker pair (all shots, newest last). */
function useShotData(
  plays: Play[],
  homeTeamId: string,
  homeColor: string,
  awayColor: string,
): ShotItem[] {
  return useMemo(() => {
    const shotPlays = plays.filter(
      (p) => p.shootingPlay || isFreeThrow(p),
    );

    const arcDurationMs = 2000;

    return shotPlays.map((p) => {
      const isHome = p.team?.id === homeTeamId;
      const isFT = isFreeThrow(p);
      const coord = isFT
        ? FT_COORD
        : isValidESPNCoord(p.coordinate)
          ? p.coordinate!
          : AT_BASKET_COORD;
      const [u, v] = espnToUV(coord.x, coord.y, isHome);
      const made = p.scoringPlay && (p.scoreValue ?? 0) >= 1;
      const baseColor = isHome ? `#${homeColor}` : `#${awayColor}`;

      const marker: ShotMarker = {
        id: `m-${p.id}`,
        u,
        v,
        color: isFT ? (made ? '#e8d84a' : '#556677') : (made ? baseColor : '#556677'),
        radius: made ? 0.7 : 0.5,
      };

      const startUV: [number, number] = [u, v];
      const endUV: [number, number] = isHome
        ? [0.5, FAR_BASKET_V]
        : [0.5, NEAR_BASKET_V];

      const missed = !p.scoringPlay || (p.scoreValue ?? 0) === 0;

      // Apex scales with shot distance for a realistic arc height.
      const distFt = Math.sqrt(
        Math.pow(coord.x - COURT_W / 2, 2) +
        Math.pow(coord.y, 2),
      );
      const apex = Math.max(2, Math.min(7, distFt * 0.2 + 2));

      const arc: ArcShot = {
        id: `arc-${p.id}`,
        startUV,
        endUV,
        durationMs: arcDurationMs,
        startDelayMs: 0,
        apex,
        startY: 7,
        endY: RIM_HEIGHT,
        easing: 'gravity' as const,
        color: missed ? '#cc3300' : '#f06000',
        trailColor: missed ? '#ff2222' : '#22cc44',
        missed,
        missDeflect: missed ? stableDeflect(p.id) : undefined,
        enabled: true,
      };

      return { arc, marker };
    });
  }, [plays, homeTeamId, homeColor, awayColor]);
}

const DEMO_ARCS: ArcShot[] = [
  {
    id: 'arc-1',
    startUV: [0.18, 0.2],
    endUV: [0.5, NEAR_BASKET_V],
    durationMs: 1100,
    startDelayMs: 0,
    apex: 7,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#f06000',
    trailColor: '#ff0000',
  },
  {
    id: 'arc-2',
    startUV: [0.82, 0.35],
    endUV: [0.5, NEAR_BASKET_V],
    durationMs: 1000,
    startDelayMs: 1250,
    apex: 9,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#f06000',
    trailColor: '#0b8e01',
  },
  {
    id: 'arc-3',
    startUV: [0.5, 0.78],
    endUV: [0.5, FAR_BASKET_V],
    durationMs: 1200,
    startDelayMs: 2450,
    apex: 7,
    startY: 7,
    endY: RIM_HEIGHT,
    easing: 'gravity',
    color: '#f06000',
    trailColor: '#ff0000',
  },
];

const DEMO_MARKERS: ShotMarker[] = [
  { id: 'm-1', u: 0.18, v: 0.2, color: '#087f5b' },
];

export function ThreeCourtScene({
  markers: markersProp,
  arcs: arcsProp,
  plays,
  homeTeamId = '',
  homeColor = 'c9082a',
  awayColor = '0077c0',
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
  // ── Shot queue: play every new shot in order, then loop the last one ──
  const ARC_DURATION_MS = 2000;
  const ARC_GAP_MS = 400;   // pause between queued shots
  const ARC_LOOP_MS = 5500; // idle replay interval when queue is empty

  /* All shot plays as arc/marker pairs — newest last */
  const allShotItems = useShotData(plays ?? [], homeTeamId, homeColor, awayColor);

  /* Ref-based queue so push/shift never trigger extra renders */
  const pendingQueueRef = useRef<ShotItem[]>([]);
  const seenShotIdsRef = useRef(new Set<string>());
  const isPlayingRef = useRef(false);

  /* The shot currently being animated + a key to force R3F remount */
  const [displayItem, setDisplayItem] = useState<ShotItem | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /* Pop the next shot from the queue and start playing it */
  const advance = useCallback(() => {
    if (pendingQueueRef.current.length > 0) {
      const next = pendingQueueRef.current.shift()!;
      isPlayingRef.current = true;
      setIsPlaying(true);
      setDisplayItem(next);
      setAnimKey((k) => k + 1);
    } else {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  /* Enqueue any newly seen shots whenever the plays prop updates */
  useEffect(() => {
    if (!plays) return;
    let hadNew = false;
    for (const item of allShotItems) {
      const id = String(item.arc.id);
      if (!seenShotIdsRef.current.has(id)) {
        seenShotIdsRef.current.add(id);
        pendingQueueRef.current.push(item);
        hadNew = true;
      }
    }
    if (hadNew && !isPlayingRef.current) {
      advance();
    }
  }, [allShotItems, plays, advance]);

  /* After each shot finishes, advance to the next one */
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(advance, ARC_DURATION_MS + ARC_GAP_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, isPlaying, advance]);

  /* When queue is empty, loop the last displayed shot on a slow interval */
  useEffect(() => {
    if (isPlaying || !displayItem) return;
    const id = setInterval(() => setAnimKey((k) => k + 1), ARC_LOOP_MS);
    return () => clearInterval(id);
  }, [isPlaying, displayItem]);

  /* Stamp animKey onto the arc id so R3F sees it as a new component each cycle */
  const resolvedMarkers = useMemo(() => {
    if (markersProp) return markersProp;
    if (!plays) return DEMO_MARKERS;
    return displayItem ? [displayItem.marker] : [];
  }, [markersProp, plays, displayItem]);

  const resolvedArcs = useMemo(() => {
    if (arcsProp) return arcsProp;
    if (!plays) return DEMO_ARCS;
    if (!displayItem) return [];
    return [{ ...displayItem.arc, id: `${displayItem.arc.id}-${animKey}` }];
  }, [arcsProp, plays, displayItem, animKey]);

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
