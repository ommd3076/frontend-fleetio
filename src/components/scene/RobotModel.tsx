import { useMemo } from 'react';
import type { FleetModels } from './assets';

export function RobotModel({ models, payload = false, detail = true }: { models: FleetModels; payload?: boolean; detail?: boolean }) {
  const model = useMemo(() => (detail ? models.agv : models.agvLOD).clone(true), [models, detail]);
  return <group>
    <primitive object={model} dispose={null} />
    <mesh position={[0, .135, -.548]}><boxGeometry args={[.35, .032, .009]} /><meshStandardMaterial color="#5ae4ce" emissive="#35c3be" emissiveIntensity={1.3} /></mesh>
    {payload && <group position={[0, .515, 0]}>
      <mesh castShadow><boxGeometry args={[.58, .47, .62]} /><meshStandardMaterial color="#b99464" roughness={.96} /></mesh>
      <mesh position={[0, .236, 0]}><boxGeometry args={[.10, .004, .623]} /><meshStandardMaterial color="#d1b486" roughness={.95} /></mesh>
      <mesh position={[0, 0, -.312]}><planeGeometry args={[.21, .13]} /><meshStandardMaterial color="#e7ded0" roughness={1} /></mesh>
    </group>}
  </group>;
}
