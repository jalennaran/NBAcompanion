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
  }, [apex, durationMs, endUV, startDelayMs, startUV]);

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
