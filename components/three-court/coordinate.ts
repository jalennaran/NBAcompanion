export const COURT_W = 50;
export const COURT_H = 94;

export type CourtUV = {
  u: number;
  v: number;
};

export type CourtWorldXZ = {
  x: number;
  z: number;
};

export type CourtMapOptions = {
  courtWidth?: number;
  courtHeight?: number;
  clamp?: boolean;
};

const EPSILON = 1e-8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Court length is mapped to world Z because Y is reserved as up in Three.js.
 * This keeps a natural floor plane (XZ) where shot markers/arcs sit above Y=0.
 */
export function courtUVToWorld(
  u: number,
  v: number,
  options: CourtMapOptions = {},
): CourtWorldXZ {
  const width = options.courtWidth ?? COURT_W;
  const height = options.courtHeight ?? COURT_H;
  const uu = options.clamp ? clamp01(u) : u;
  const vv = options.clamp ? clamp01(v) : v;

  // u:[0..1] -> x:[-W/2..+W/2], v:[0..1] -> z:[-H/2..+H/2]
  return {
    x: (uu - 0.5) * width,
    z: (vv - 0.5) * height,
  };
}

export function worldToCourtUV(
  x: number,
  z: number,
  options: CourtMapOptions = {},
): CourtUV {
  const width = options.courtWidth ?? COURT_W;
  const height = options.courtHeight ?? COURT_H;

  const u = (x + width / 2) / width;
  const v = (z + height / 2) / height;

  return {
    u: options.clamp ? clamp01(u) : u,
    v: options.clamp ? clamp01(v) : v,
  };
}

/**
 * Quick round-trip checks you can call during startup/tests.
 */
export function runCoordinateSanityChecks(options: CourtMapOptions = {}): void {
  const samples: CourtUV[] = [
    { u: 0, v: 0 },
    { u: 0.5, v: 0.5 },
    { u: 1, v: 1 },
    { u: 0.12, v: 0.91 },
    { u: 0.82, v: 0.07 },
  ];

  for (const sample of samples) {
    const world = courtUVToWorld(sample.u, sample.v, options);
    const uv = worldToCourtUV(world.x, world.z, options);

    if (Math.abs(uv.u - sample.u) > EPSILON || Math.abs(uv.v - sample.v) > EPSILON) {
      throw new Error(
        `Court coordinate sanity check failed for (${sample.u}, ${sample.v}) -> (${uv.u}, ${uv.v})`,
      );
    }
  }
}
