'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/* ────────── NBA standard dimensions (feet) ────────── */
const RIM_HEIGHT = 10;
const RIM_RADIUS = 0.75; // 18″ inner diameter
const RIM_TUBE = 0.04; // ring-tube thickness
const BACKBOARD_W = 6;
const BACKBOARD_H = 3.5; // 42″
const BACKBOARD_DEPTH = 0.15;
const BB_FROM_BASELINE = 4; // face of backboard 4′ from endline
const BASKET_FROM_BASELINE = 5.25;
const BB_BOTTOM_Y = 9;
const BB_CENTER_Y = BB_BOTTOM_Y + BACKBOARD_H / 2; // 10.75
const SQUARE_W = 2; // shooter-square 24″
const SQUARE_H = 1.5; // shooter-square 18″
const NET_LEN = 1.5; // net drop
const STANCHION_SETBACK = 3; // pole distance behind baseline

type HoopProps = {
  /** z coordinate of the baseline */
  baselineZ: number;
  /** +1 if hoop faces toward +z, −1 toward −z */
  direction: 1 | -1;
};

export function Hoop({ baselineZ, direction }: HoopProps) {
  const bbZ = baselineZ + direction * BB_FROM_BASELINE;
  const rimZ = baselineZ + direction * BASKET_FROM_BASELINE;
  const poleZ = baselineZ - direction * STANCHION_SETBACK;
  const faceOffsetZ = direction * (BACKBOARD_DEPTH / 2 + 0.01);

  /* ── memoised geometries ── */
  const bbEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(BACKBOARD_W, BACKBOARD_H, BACKBOARD_DEPTH);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);

  const squareEdges = useMemo(() => {
    const plane = new THREE.PlaneGeometry(SQUARE_W, SQUARE_H);
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return edges;
  }, []);

  /* dispose on unmount */
  useEffect(() => () => { bbEdges.dispose(); squareEdges.dispose(); }, [bbEdges, squareEdges]);

  const rimArmLen = Math.abs(rimZ - bbZ);
  const poleArmLen = Math.abs(bbZ - poleZ);

  return (
    <group>
      {/* ── Backboard (semi-transparent glass) ── */}
      <mesh position={[0, BB_CENTER_Y, bbZ]}>
        <boxGeometry args={[BACKBOARD_W, BACKBOARD_H, BACKBOARD_DEPTH]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          roughness={0.05}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Backboard border lines */}
      <lineSegments position={[0, BB_CENTER_Y, bbZ]} geometry={bbEdges}>
        <lineBasicMaterial color="#aaaaaa" />
      </lineSegments>

      {/* Shooter's square on front face */}
      <lineSegments position={[0, BB_CENTER_Y, bbZ + faceOffsetZ]} geometry={squareEdges}>
        <lineBasicMaterial color="#aaaaaa" />
      </lineSegments>

      {/* ── Rim (orange torus) ── */}
      <mesh position={[0, RIM_HEIGHT, rimZ]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 12, 32]} />
        <meshStandardMaterial color="#ff6600" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Rim connector arm (backboard → rim) */}
      <mesh position={[0, RIM_HEIGHT, (bbZ + rimZ) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, rimArmLen, 6]} />
        <meshStandardMaterial color="#555555" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* ── Net (wireframe cone — wide at rim, narrow at bottom) ── */}
      <mesh position={[0, RIM_HEIGHT - NET_LEN / 2, rimZ]}>
        <cylinderGeometry args={[RIM_RADIUS, RIM_RADIUS * 0.35, NET_LEN, 12, 4, true]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.45} />
      </mesh>

      {/* ── Stanchion — vertical pole ── */}
      <mesh position={[0, BB_CENTER_Y / 2, poleZ]}>
        <cylinderGeometry args={[0.2, 0.28, BB_CENTER_Y, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Stanchion — horizontal arm */}
      <mesh position={[0, BB_CENTER_Y, (poleZ + bbZ) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, poleArmLen, 6]} />
        <meshStandardMaterial color="#333333" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  );
}
