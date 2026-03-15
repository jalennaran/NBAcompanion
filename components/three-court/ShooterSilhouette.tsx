'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

export type ShooterSilhouetteProps = {
  position: [number, number, number];
  target: [number, number, number];
  scale?: number;
  color?: string;
};

function Limb({
  from,
  to,
  radius,
  color,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
  color: string;
}) {
  const mid = useMemo(() => new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), [from, to]);
  const length = useMemo(() => from.distanceTo(to), [from, to]);

  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [from, to]);

  return (
    <mesh position={mid} quaternion={quaternion}>
      <capsuleGeometry args={[radius, length - radius * 2, 4, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Joint({
  pos,
  radius,
  color,
}: {
  pos: THREE.Vector3;
  radius: number;
  color: string;
}) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[radius, 10, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

const L_FOOT  = new THREE.Vector3(-0.35, 0.0, 0.1);
const R_FOOT  = new THREE.Vector3( 0.35, 0.0, -0.05);

const L_ANKLE = new THREE.Vector3(-0.35, 0.25, 0.1);
const R_ANKLE = new THREE.Vector3( 0.35, 0.25, -0.05);

const L_KNEE  = new THREE.Vector3(-0.3,  1.6,  0.15);
const R_KNEE  = new THREE.Vector3( 0.3,  1.6, -0.05);

const L_HIP   = new THREE.Vector3(-0.25, 2.9,  0.0);
const R_HIP   = new THREE.Vector3( 0.25, 2.9,  0.0);
const WAIST   = new THREE.Vector3( 0.0,  2.9,  0.0);

const CHEST   = new THREE.Vector3( 0.0,  4.5,  0.0);

const L_SHOULDER = new THREE.Vector3(-0.6, 4.5,  0.0);
const R_SHOULDER = new THREE.Vector3( 0.6, 4.5,  0.0);

const NECK    = new THREE.Vector3( 0.0,  4.75, 0.0);
const HEAD    = new THREE.Vector3( 0.0,  5.25, 0.0);

const R_ELBOW = new THREE.Vector3( 0.85, 4.8, 0.25);
const R_HAND  = new THREE.Vector3( 0.9,  5.3, 0.35);

const L_ELBOW = new THREE.Vector3(-0.55, 5.3,  0.15);
const L_HAND  = new THREE.Vector3(-0.45, 6.4,  0.25);

const LIMB_R  = 0.12;
const ARM_R   = 0.09;
const LEG_R   = 0.14;
const FOOT_R  = 0.08;

export function ShooterSilhouette({
  position,
  target,
  scale: scaleProp = 1,
  color = '#1a1a2e',
}: ShooterSilhouetteProps) {
  const yRotation = useMemo(() => {
    const dx = target[0] - position[0];
    const dz = target[2] - position[2];
    return Math.atan2(dx, dz);
  }, [position, target]);

  return (
    <group position={position} rotation={[0, yRotation, 0]} scale={scaleProp}>
      {/* Head */}
      <Joint pos={HEAD} radius={0.3} color={color} />

      {/* Neck */}
      <Limb from={NECK} to={HEAD} radius={0.1} color={color} />

      {/* Torso */}
      <Limb from={WAIST} to={CHEST} radius={0.28} color={color} />

      {/* Shoulders -> Chest connection */}
      <Joint pos={CHEST} radius={0.28} color={color} />

      {/* Right arm (guide) */}
      <Limb from={R_SHOULDER} to={R_ELBOW} radius={ARM_R} color={color} />
      <Joint pos={R_ELBOW} radius={ARM_R * 1.1} color={color} />
      <Limb from={R_ELBOW} to={R_HAND} radius={ARM_R * 0.85} color={color} />
      <Joint pos={R_HAND} radius={ARM_R * 0.9} color={color} />

      {/* Left arm (shooting) */}
      <Limb from={L_SHOULDER} to={L_ELBOW} radius={ARM_R} color={color} />
      <Joint pos={L_ELBOW} radius={ARM_R * 1.1} color={color} />
      <Limb from={L_ELBOW} to={L_HAND} radius={ARM_R * 0.85} color={color} />
      <Joint pos={L_HAND} radius={ARM_R * 0.9} color={color} />

      {/* Right leg */}
      <Limb from={R_HIP} to={R_KNEE} radius={LEG_R} color={color} />
      <Joint pos={R_KNEE} radius={LEG_R} color={color} />
      <Limb from={R_KNEE} to={R_ANKLE} radius={LIMB_R} color={color} />
      <Limb from={R_ANKLE} to={R_FOOT} radius={FOOT_R} color={color} />

      {/* Left leg */}
      <Limb from={L_HIP} to={L_KNEE} radius={LEG_R} color={color} />
      <Joint pos={L_KNEE} radius={LEG_R} color={color} />
      <Limb from={L_KNEE} to={L_ANKLE} radius={LIMB_R} color={color} />
      <Limb from={L_ANKLE} to={L_FOOT} radius={FOOT_R} color={color} />

      {/* Waist joint */}
      <Joint pos={WAIST} radius={0.25} color={color} />
    </group>
  );
}
