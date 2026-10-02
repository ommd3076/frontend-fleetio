import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Robot } from '../../types';
import { loadFleetModels } from './assets';
import type { FleetModels } from './assets';
import { RobotModel } from './RobotModel';

export function RobotPreview({ robot }: { robot: Robot }) {
  const [models, setModels] = useState<FleetModels | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let mounted = true; loadFleetModels().then(m => { if (mounted) setModels(m); }).catch(() => { if (mounted) setFailed(true); }); return () => { mounted = false; }; }, []);
  if (!models) return <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8494a5', fontSize: 11 }}>{failed ? 'Asset preview unavailable' : 'Loading AGV…'}</div>;
  return <Canvas frameloop="demand" dpr={1} camera={{ position: [1.45, 1.15, 1.8], fov: 34 }} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%', minHeight: 140 }} onCreated={({ camera }) => camera.lookAt(0, .3, 0)}>
    <ambientLight intensity={1.8} /><directionalLight position={[2, 4, 1]} intensity={3} /><directionalLight position={[-2, 1, -2]} intensity={1.2} color="#afc5ff" />
    <RobotModel models={models} payload={robot.payload} />
  </Canvas>;
}
