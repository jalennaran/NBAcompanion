'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { courtUVToWorld } from './coordinate';

export type BallArcEasing = 'linear' | 'gravity';

export type BallArcProps = {
  startUV: [number, number];
  endUV: [number, number];
  durationMs: number;
  apex: number;
  startDelayMs?: number;
  /** @deprecated use startY instead */
  baseY?: number;
  startY?: number;
  endY?: number;
  radius?: number;
  color?: THREE.ColorRepresentation;
  trailColor?: THREE.ColorRepresentation;
  trailSegments?: number;
  easing?: BallArcEasing;
  showTrail?: boolean;
  /** If true the shot misses: ball deflects off the rim and drops */
  missed?: boolean;
  /** Signed X-axis deflection in feet after hitting the rim (default ±2.5) */
  missDeflect?: number;
  onComplete?: () => void;
};

function easeT(t: number, easing: BallArcEasing): number {
  if (easing === 'gravity') {
    // Gravity-like horizontal timing: starts slower, ends faster.
    return t * t;
  }

  return t;
}

export function BallArc({
  startUV,
  endUV,
  durationMs,
  apex,
  startDelayMs = 0,
  baseY,
  startY: startYProp,
  endY: endYProp,
  radius = 0.32,
  color = '#d9480f',
  trailColor = '#ff922b',
  trailSegments = 48,
  easing = 'linear',
  showTrail = true,
  missed = false,
  missDeflect = 2.5,
  onComplete,
}: BallArcProps) {
  const sY = startYProp ?? baseY ?? 0.4;
  const eY = endYProp ?? baseY ?? 0.4;

  const ballRef = useRef<THREE.Mesh>(null);
  const startedAtMsRef = useRef<number | null>(null);
  const completeRef = useRef(false);

  const start = useMemo(() => courtUVToWorld(startUV[0], startUV[1]), [startUV]);
  const end = useMemo(() => courtUVToWorld(endUV[0], endUV[1]), [endUV]);

  /**
   * y(t) = lerp(startY, endY, t) + 4 * apex * t * (1 - t)
   *
   * This adds a symmetric parabolic hump on top of a linear ramp from
   * startY → endY, so the ball rises to the peak then drops into the basket.
   * At t=0 → startY, at t=1 → endY, peak ≈ midpoint + apex.
   */
  function arcY(t: number): number {
    return THREE.MathUtils.lerp(sY, eY, t) + 4 * apex * t * (1 - t);
  }

  const trailPositions = useMemo(() => {
    const points = new Float32Array((trailSegments + 1) * 3);

    for (let i = 0; i <= trailSegments; i += 1) {
      const t = i / trailSegments;
      const x = THREE.MathUtils.lerp(start.x, end.x, t);
      const z = THREE.MathUtils.lerp(start.z, end.z, t);
      const y = arcY(t);

      const ptr = i * 3;
      points[ptr] = x;
      points[ptr + 1] = y;
      points[ptr + 2] = z;
    }

    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apex, sY, eY, end.x, end.z, start.x, start.z, trailSegments]);

  useEffect(() => {
    startedAtMsRef.current = null;
    completeRef.current = false;
  }, [apex, durationMs, endUV, missed, startDelayMs, startUV]);

  useFrame((state) => {
    const nowMs = state.clock.elapsedTime * 1000;

    if (startedAtMsRef.current === null) {
      startedAtMsRef.current = nowMs;
    }

    const elapsedMs = nowMs - startedAtMsRef.current - startDelayMs;

    if (elapsedMs < 0) {
      if (ballRef.current) {
        ballRef.current.position.set(start.x, sY, start.z);
      }
      return;
    }

    if (missed) {
      /*
       * Three-phase miss animation:
       *   Phase 1 (0 → 55 %): standard parabolic arc, shooter → rim
       *   Phase 2 (55 → 80 %): ball rattles off the rim — sharp upward pop
       *                        with lateral (X + Z) scatter
       *   Phase 3 (80 → 100 %): ball drops away from the rim to the floor
       */
      const phase1End = durationMs * 0.55;
      const phase2End = durationMs * 0.80;
      const phase2Dur = durationMs * 0.25;
      const phase3Dur = durationMs * 0.20;

      // Lateral scatter: X from prop, Z is ½ of that in the same direction
      const bx = end.x + missDeflect;
      const bz = end.z + missDeflect * 0.5;

      if (elapsedMs <= phase1End) {
        /* ── Phase 1: arc from shooter to the rim ── */
        const rawT = THREE.MathUtils.clamp(elapsedMs / phase1End, 0, 1);
        const t = easeT(rawT, easing);
        const x = THREE.MathUtils.lerp(start.x, end.x, t);
        const z = THREE.MathUtils.lerp(start.z, end.z, t);
        const y = THREE.MathUtils.lerp(sY, eY, t) + 4 * apex * t * (1 - t);
        if (ballRef.current) ballRef.current.position.set(x, y, z);
      } else if (elapsedMs <= phase2End) {
        /* ── Phase 2: rim rattle — upward pop + lateral scatter ── */
        const t2 = THREE.MathUtils.clamp((elapsedMs - phase1End) / phase2Dur, 0, 1);
        const rimBounceApex = 2.5;
        const x = THREE.MathUtils.lerp(end.x, bx, t2);
        const z = THREE.MathUtils.lerp(end.z, bz, t2);
        // Starts at rim height, pops up, then back down to slightly above rim
        const y = eY + 4 * rimBounceApex * t2 * (1 - t2);
        if (ballRef.current) ballRef.current.position.set(x, y, z);
      } else {
        /* ── Phase 3: ball drops from scatter position to the floor ── */
        const t3 = THREE.MathUtils.clamp((elapsedMs - phase2End) / phase3Dur, 0, 1);
        // Accelerating drop (gravity-like)
        const y = THREE.MathUtils.lerp(eY, 0.4, t3 * t3);
        if (ballRef.current) ballRef.current.position.set(bx, y, bz);

        if (t3 >= 1 && !completeRef.current) {
          completeRef.current = true;
          onComplete?.();
        }
      }
      return;
    }

    const rawT = THREE.MathUtils.clamp(elapsedMs / durationMs, 0, 1);
    const t = easeT(rawT, easing);

    const x = THREE.MathUtils.lerp(start.x, end.x, t);
    const z = THREE.MathUtils.lerp(start.z, end.z, t);
    const y = arcY(t);

    if (ballRef.current) {
      ballRef.current.position.set(x, y, z);
    }

    if (rawT >= 1 && !completeRef.current) {
      completeRef.current = true;
      onComplete?.();
    }
  });

  return (
    <group>
      {showTrail ? (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={trailColor} transparent opacity={0.8} />
        </line>
      ) : null}

      <mesh ref={ballRef} position={[start.x, sY, start.z]}>
        <sphereGeometry args={[radius, 18, 18]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
