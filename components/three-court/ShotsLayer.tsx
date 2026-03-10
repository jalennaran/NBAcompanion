'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BallArc, type BallArcProps } from './BallArc';
import { courtUVToWorld } from './coordinate';

export type ShotMarker = {
  id: string | number;
  u: number;
  v: number;
  color?: THREE.ColorRepresentation;
  radius?: number;
};

export type ArcShot = Omit<BallArcProps, 'startUV' | 'endUV'> & {
  id: string | number;
  startUV: [number, number];
  endUV: [number, number];
  enabled?: boolean;
};

export type ShotsLayerProps = {
  markers?: ShotMarker[];
  arcs?: ArcShot[];
  markerRadius?: number;
  markerColor?: THREE.ColorRepresentation;
  markerY?: number;
};

export function ShotsLayer({
  markers = [],
  arcs = [],
  markerRadius = 0.7,
  markerColor = '#0b7285',
  markerY = 0.03,
}: ShotsLayerProps) {
  const markerMeshRef = useRef<THREE.InstancedMesh>(null);

  const tempTransform = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const markerQuaternion = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
    [],
  );

  const markerCapacity = Math.max(markers.length, 1);

  useEffect(() => {
    const mesh = markerMeshRef.current;
    if (!mesh) {
      return;
    }

    mesh.count = markers.length;

    for (let i = 0; i < markers.length; i += 1) {
      const shot = markers[i];
      const { x, z } = courtUVToWorld(shot.u, shot.v);

      tempTransform.position.set(x, markerY, z);
      tempTransform.quaternion.copy(markerQuaternion);
      tempTransform.scale.setScalar(shot.radius ?? markerRadius);
      tempTransform.updateMatrix();

      mesh.setMatrixAt(i, tempTransform.matrix);
      tempColor.set(shot.color ?? markerColor);
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [markerColor, markerQuaternion, markerRadius, markerY, markers, tempColor, tempTransform]);

  return (
    <group>
      <instancedMesh
        ref={markerMeshRef}
        args={[
          null as unknown as THREE.BufferGeometry,
          null as unknown as THREE.Material,
          markerCapacity,
        ]}
      >
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial toneMapped={false} vertexColors />
      </instancedMesh>

      {arcs
        .filter((arc) => arc.enabled !== false)
        .map(({ id, startUV, endUV, ...arcProps }) => (
          <BallArc key={id} startUV={startUV} endUV={endUV} {...arcProps} />
        ))}
    </group>
  );
}
