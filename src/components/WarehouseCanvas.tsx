import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { MotionPath } from '../simulation/motionPath';
import type { GridNode, Robot } from '../types';

const MAP_HEIGHT = 42;
const H_AISLES = [3, 9, 15, 21, 27, 33, 39];
const V_AISLES = [8, 22, 38, 54];
const sy = (y: number) => MAP_HEIGHT - y;
const labelFor = (id: string) => id.replace('RACK_', '').replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '').replaceAll('_', ' ');
const stateLabel = (state: Robot['state']) => state.replaceAll('_', ' ').toLowerCase();

function Rack({ node }: { node: GridNode }) {
  const x = node.x - 4.65;
  const y = sy(node.y) - 1.25;
  return <g>
    <rect x={x + 0.16} y={y + 0.18} width="9.3" height="2.5" rx="0.15" fill="#02070b" opacity="0.55" />
    <rect x={x} y={y} width="9.3" height="2.5" rx="0.14" fill="#142735" stroke="#294252" strokeWidth="0.12" />
    {[0.62, 1.25, 1.88].map(offset => <line key={offset} x1={x + 0.2} y1={y + offset} x2={x + 9.1} y2={y + offset} stroke="#345061" strokeWidth="0.08" />)}
    {Array.from({ length: 8 }, (_, index) => <g key={index}>
      <line x1={x + 0.55 + index * 1.08} y1={y + 0.15} x2={x + 0.55 + index * 1.08} y2={y + 2.35} stroke="#203b4c" strokeWidth="0.07" />
      <rect x={x + 0.68 + index * 1.08} y={y + (index % 2 ? 0.82 : 1.5)} width="0.58" height="0.32" rx="0.04" fill={index % 3 === 0 ? '#8a765a' : '#536b78'} opacity="0.72" />
    </g>)}
    <rect x={x + 0.32} y={y + 0.28} width="1.1" height="0.56" rx="0.1" fill="#07131c" stroke="#3d5a6d" strokeWidth="0.07" />
    <text x={x + 0.87} y={y + 0.68} textAnchor="middle" fill="#d1dde4" fontSize="0.52" fontWeight="650" letterSpacing="0.06">{labelFor(node.id)}</text>
  </g>;
}

function RouteTrace({ robot, selected }: { robot: Robot; selected: boolean }) {
  const points = useMemo(() => {
    if (robot.route.length < 2) return '';
    const path = new MotionPath(robot.route.map(step => ({ x: step.x, y: step.y })), 1.15);
    const sampleCount = Math.max(2, Math.ceil(path.totalLength / 0.24));
    return Array.from({ length: sampleCount + 1 }, (_, index) => {
      const point = path.getPointAtDistance(path.totalLength * index / sampleCount).position;
      return `${point.x},${sy(point.y)}`;
    }).join(' ');
  }, [robot.route]);
  if (!points) return null;
  const color = robot.payload ? '#50d6a1' : '#45bfff';
  return <g className="pointer-events-none">
    {selected && <polyline points={points} fill="none" stroke={color} strokeWidth="0.95" opacity="0.13" strokeLinecap="round" strokeLinejoin="round" />}
    <polyline points={points} fill="none" stroke={color} strokeWidth={selected ? 0.22 : 0.1} opacity={selected ? 0.96 : 0.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={selected ? '0.65 0.28' : '0.35 0.34'} />
  </g>;
}

function FutureTrace({ robotId, selected }: { robotId: string; selected: boolean }) {
  const futureTrajectories = useStore(state => state.futureTrajectories);
  const blockedBy = useStore(state => state.blockedBy);
  const points = futureTrajectories[robotId];
  const blocked = Boolean(blockedBy[robotId]);
  if (!points) return null;
  if (points.length < 2) return null;
  const path = points.map(point => `${point.x},${sy(point.y)}`).join(' ');
  const color = blocked ? '#f5b94e' : '#78d8ff';
  return <g className="pointer-events-none" opacity={selected ? 0.9 : 0.38}>
    <polyline points={path} fill="none" stroke={color} strokeWidth={selected ? 0.13 : 0.07} strokeDasharray="0.18 0.2" />
    {points.slice(1).map((point, index) => <circle key={index} cx={point.x} cy={sy(point.y)} r={selected ? 0.13 : 0.085} fill={color} opacity={1 - index * 0.1} />)}
  </g>;
}

function RobotMarker({ robot }: { robot: Robot }) {
  const rootRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const targetRef = useRef(robot);
  const selected = useStore(state => state.selectedRobotId === robot.id);
  const setSelected = useStore(state => state.setSelectedRobot);
  targetRef.current = robot;

  useEffect(() => {
    const pose = { x: robot.position.x, y: robot.position.y, heading: robot.heading };
    let previous = performance.now();
    let animationFrame = 0;
    const animate = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      const target = targetRef.current;
      const blend = 1 - Math.exp(-delta * 22);
      pose.x += (target.position.x - pose.x) * blend;
      pose.y += (target.position.y - pose.y) * blend;
      const angleDelta = Math.atan2(Math.sin(target.heading - pose.heading), Math.cos(target.heading - pose.heading));
      pose.heading += angleDelta * blend;
      rootRef.current?.setAttribute('transform', `translate(${pose.x} ${sy(pose.y)})`);
      bodyRef.current?.setAttribute('transform', `rotate(${-pose.heading * 180 / Math.PI})`);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const color = robot.state === 'WAITING' ? '#f5b94e' : robot.payload ? '#52d6a1' : robot.state === 'IDLE' ? '#7890a1' : '#45bfff';
  return <g ref={rootRef} transform={`translate(${robot.position.x} ${sy(robot.position.y)})`} onClick={() => setSelected(robot.id)} className="cursor-pointer">
    {selected && <circle cx="0" cy="0" r="1.02" fill="none" stroke={color} strokeWidth="0.13" opacity="0.85" strokeDasharray="0.32 0.2" />}
    <g ref={bodyRef} transform={`rotate(${-robot.heading * 180 / Math.PI})`}>
      <ellipse cx="0.08" cy="0.12" rx="0.83" ry="0.54" fill="#02070a" opacity="0.6" />
      <rect x="-0.72" y="-0.48" width="1.44" height="0.96" rx="0.34" fill="#d9e2e7" stroke="#607989" strokeWidth="0.08" />
      <rect x="-0.44" y="-0.36" width="0.78" height="0.72" rx="0.24" fill="#263946" />
      <rect x="0.38" y="-0.34" width="0.23" height="0.68" rx="0.1" fill="#0c1a24" />
      <rect x="0.51" y="-0.27" width="0.1" height="0.54" rx="0.04" fill={color} />
      <circle cx="0.69" cy="-0.22" r="0.07" fill={color} />
      <circle cx="0.69" cy="0.22" r="0.07" fill={color} />
      <rect x="-0.33" y="-0.43" width="0.44" height="0.08" rx="0.04" fill="#071019" />
      <rect x="-0.33" y="0.35" width="0.44" height="0.08" rx="0.04" fill="#071019" />
    </g>
    <g transform="translate(-1.15 -1.45)">
      <rect width="2.3" height="0.78" rx="0.16" fill="#07131ded" stroke={selected ? color : '#284151'} strokeWidth="0.08" />
      <text x="0.18" y="0.32" fill="#eef5f8" fontSize="0.38" fontWeight="700">{robot.id}</text>
      <circle cx="0.2" cy="0.56" r="0.07" fill={color} />
      <text x="0.34" y="0.65" fill="#91a8b6" fontSize="0.28">{stateLabel(robot.state)}</text>
    </g>
  </g>;
}

function WarehousePlan() {
  const graph = useStore(state => state.graph);
  const robots = useStore(state => state.robots);
  const tasks = useStore(state => state.tasks);
  const selectedId = useStore(state => state.selectedRobotId);
  const showRoutes = useStore(state => state.showRoutes);
  if (!graph) return null;
  const nodes = Object.values(graph.nodes);
  const racks = nodes.filter(node => node.type === 'RACK');
  const staging = nodes.filter(node => node.type === 'STAGING');
  const drops = nodes.filter(node => node.type === 'DROP');
  const serviceNodes = nodes.filter(node => node.type === 'PICKUP');
  const activePickups = new Set(Object.values(tasks).filter(task => task.status !== 'COMPLETED').map(task => task.pickupNodeId));

  return <svg viewBox="0 0 60 42" preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Top-down live warehouse map">
    <defs>
      <pattern id="floor-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M 2 0 L 0 0 0 2" fill="none" stroke="#153040" strokeWidth="0.035" /></pattern>
      <filter id="route-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.18" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <marker id="lane-arrow" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#426274" /></marker>
    </defs>
    <rect width="60" height="42" fill="#07121a" />
    <rect x="0.5" y="0.5" width="59" height="41" rx="0.35" fill="url(#floor-grid)" stroke="#294455" strokeWidth="0.12" />
    <rect x="0.9" y="2.5" width="5.2" height="37" rx="0.25" fill="#0b2433" stroke="#24526b" strokeWidth="0.1" />
    <rect x="56.1" y="27.2" width="3" height="10.4" rx="0.25" fill="#0e302d" stroke="#2e7d69" strokeWidth="0.1" />
    <rect x="6.3" y="0.9" width="49.3" height="2.2" rx="0.18" fill="#0d1e29" stroke="#223a49" strokeWidth="0.08" />

    {H_AISLES.map(y => <g key={`h-${y}`}>
      <rect x="5.5" y={sy(y) - 1.05} width="51" height="2.1" rx="0.12" fill="#102733" />
      <line x1="5.8" y1={sy(y)} x2="56.2" y2={sy(y)} stroke="#294655" strokeWidth="0.06" strokeDasharray="0.35 0.38" />
      <line x1="5.8" y1={sy(y) + 0.62} x2="56.2" y2={sy(y) + 0.62} stroke="#456879" strokeWidth="0.08" strokeDasharray="0.72 0.42" markerEnd="url(#lane-arrow)" />
      <line x1="56.2" y1={sy(y) - 0.62} x2="5.8" y2={sy(y) - 0.62} stroke="#456879" strokeWidth="0.08" strokeDasharray="0.72 0.42" markerEnd="url(#lane-arrow)" />
    </g>)}
    {V_AISLES.map(x => <g key={`v-${x}`}>
      <rect x={x - 1.05} y="2.8" width="2.1" height="37" rx="0.12" fill="#102733" />
      <line x1={x} y1="39.4" x2={x} y2="3.2" stroke="#294655" strokeWidth="0.06" strokeDasharray="0.35 0.38" />
      <line x1={x + 0.62} y1="39.4" x2={x + 0.62} y2="3.2" stroke="#456879" strokeWidth="0.08" strokeDasharray="0.72 0.42" markerEnd="url(#lane-arrow)" />
      <line x1={x - 0.62} y1="3.2" x2={x - 0.62} y2="39.4" stroke="#456879" strokeWidth="0.08" strokeDasharray="0.72 0.42" markerEnd="url(#lane-arrow)" />
    </g>)}
    {V_AISLES.flatMap(x => H_AISLES.map(y => <g key={`${x}-${y}`}>
      <circle cx={x} cy={sy(y)} r="0.32" fill="#132f3e" stroke="#416476" strokeWidth="0.08" />
      <circle cx={x} cy={sy(y)} r="0.08" fill="#6a8ea0" opacity="0.72" />
    </g>))}

    {racks.map(node => <Rack key={node.id} node={node} />)}

    {staging.map((node, index) => {
      const y = sy(node.y) - 0.7;
      const occupied = Object.values(robots).some(robot => Math.hypot(robot.position.x - node.x, robot.position.y - node.y) < 0.9);
      return <g key={node.id}>
        <rect x={node.x - 1.18} y={y} width="2.36" height="1.4" rx="0.16" fill={occupied ? '#12384a' : '#102733'} stroke={occupied ? '#3a8aae' : '#2a485a'} strokeWidth="0.09" />
        <text x={node.x - 0.88} y={y + 0.42} fill={occupied ? '#a6d9ef' : '#6e8999'} fontSize="0.37" fontWeight="650">{String(index + 1).padStart(2, '0')}</text>
      </g>;
    })}

    {drops.map(node => <g key={node.id}>
      <rect x={node.x - 1.55} y={sy(node.y) - 1.05} width="3.1" height="2.1" rx="0.2" fill="#124237" stroke="#4bc092" strokeWidth="0.12" />
      <path d={`M${node.x - 1.15},${sy(node.y)} H${node.x + 0.45} M${node.x + 0.1},${sy(node.y) - 0.35} L${node.x + 0.45},${sy(node.y)} L${node.x + 0.1},${sy(node.y) + 0.35}`} fill="none" stroke="#8ce9c2" strokeWidth="0.12" />
      <text x={node.x} y={sy(node.y) + 0.72} textAnchor="middle" fill="#a7e5cd" fontSize="0.4" fontWeight="650">{labelFor(node.id)}</text>
    </g>)}

    {serviceNodes.filter(node => activePickups.has(node.id)).map(node => <g key={node.id}>
      <circle cx={node.x} cy={sy(node.y)} r="0.24" fill="#43bfff" opacity="0.86" />
      <circle cx={node.x} cy={sy(node.y)} r="0.47" fill="none" stroke="#43bfff" strokeWidth="0.08" opacity="0.45" strokeDasharray="0.2 0.16" />
    </g>)}

    <text x="1.25" y="1.85" fill="#76a6c0" fontSize="0.48" letterSpacing="0.12">FLEET STAGING</text>
    <text x="56.45" y="26.55" fill="#70bea7" fontSize="0.42" letterSpacing="0.08">DISPATCH</text>
    <text x="7" y="2.32" fill="#657f8e" fontSize="0.42" letterSpacing="0.11">NORTH CROSS AISLE</text>

    <g filter="url(#route-glow)">{showRoutes && Object.values(robots).map(robot => <RouteTrace key={robot.id} robot={robot} selected={robot.id === selectedId} />)}</g>
    <g>{Object.values(robots).map(robot => <FutureTrace key={robot.id} robotId={robot.id} selected={robot.id === selectedId} />)}</g>
    {Object.values(robots).map(robot => <RobotMarker key={robot.id} robot={robot} />)}

    <g transform="translate(50.5 40.5)"><line x1="0" y1="0" x2="5" y2="0" stroke="#aec0c9" strokeWidth="0.11" /><line x1="0" y1="-0.2" x2="0" y2="0.2" stroke="#aec0c9" strokeWidth="0.1" /><line x1="5" y1="-0.2" x2="5" y2="0.2" stroke="#aec0c9" strokeWidth="0.1" /><text x="2.5" y="0.62" textAnchor="middle" fill="#76909e" fontSize="0.38">5 M</text></g>
  </svg>;
}

function MapOverlay() {
  const { robots, tasks, selectedRobotId, simulationStatus, showRoutes, setToggle, metrics, blockedBy } = useStore();
  const selected = selectedRobotId ? robots[selectedRobotId] : null;
  const task = selected?.taskId ? tasks[selected.taskId] : null;
  const active = Object.values(robots).filter(robot => !['IDLE', 'CHARGING'].includes(robot.state)).length;
  const path = selected?.route.length ? new MotionPath(selected.route.map(step => ({ x: step.x, y: step.y })), 1.15) : null;
  const progress = selected && path?.totalLength ? Math.min(100, selected.pathProgress / path.totalLength * 100) : 0;
  return <>
    <div className="absolute left-4 right-4 top-3 flex items-start justify-between gap-3">
      <div className="pointer-events-none min-w-0">
        <div className="text-[15px] font-semibold tracking-tight text-[#edf4f7]">Main warehouse</div>
        <div className="mt-0.5 truncate text-[8px] uppercase tracking-[0.12em] text-[#78909e]">Algorithm simulation · {Object.keys(robots).length} AMRs</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#203747] bg-[#07121ce8] px-2 py-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[#8ba0ad]" title={`Simulation ${simulationStatus.toLowerCase()}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${simulationStatus === 'RUNNING' ? 'bg-[#50d7a0]' : simulationStatus === 'PAUSED' ? 'bg-[#f4ba50]' : 'bg-[#6d8190]'}`} />
        <span>60 Hz</span><span className="text-[#2d4657]">·</span><span>3.0 s future</span><span className="text-[#2d4657]">·</span>
        <button className="pointer-events-auto text-[#63c8f4] hover:text-white" onClick={() => setToggle('showRoutes', !showRoutes)}>Path {showRoutes ? 'on' : 'off'}</button>
      </div>
    </div>
    {selected && <div className="pointer-events-none absolute bottom-3 left-4 right-4 grid items-center gap-1 rounded-lg border border-[#254252] bg-[#07121cf0] px-3 py-2 shadow-[0_8px_30px_#0008]" style={{ gridTemplateColumns: '1.35fr repeat(3, minmax(0, 1fr))' }}>
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5"><span className="text-[11px] font-semibold text-[#edf4f7]">{selected.id}</span><span className="h-1.5 w-1.5 rounded-full bg-[#45bfff]" /><span className="truncate text-[7px] uppercase tracking-[0.1em] text-[#79cbed]">{stateLabel(selected.state)}</span></div>
        <div className="mt-1 truncate text-[8px] text-[#7f96a4]">{task ? `${labelFor(task.pickupNodeId)} → ${labelFor(task.dropNodeId)}` : 'Awaiting assignment'}</div>
      </div>
      <Metric label="Leg" value={`${progress.toFixed(0)}%`} />
      <Metric label="Coordination" value={blockedBy[selected.id] ? `Yield to ${blockedBy[selected.id]}` : 'Corridor clear'} />
      <Metric label="Separation" value={metrics.minimumSeparation ? `${metrics.minimumSeparation.toFixed(2)} m min` : 'Monitoring'} />
    </div>}
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[7px] tracking-[0.16em] text-[#5f7888]">{label}</div><div className="mt-1 whitespace-nowrap text-[9px] text-[#d5e1e7]">{value}</div></div>;
}

export const WarehouseCanvas: React.FC = () => {
  const setSelected = useStore(state => state.setSelectedRobot);
  return <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-[#1b3140] bg-[#07121a] shadow-[inset_0_1px_0_#ffffff08]" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
    <WarehousePlan />
    <MapOverlay />
  </div>;
};
