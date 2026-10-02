import type { Robot } from '../types';
import { WAREHOUSE_LAYOUT } from '../simulation/layout';
import { useStore } from '../store';
export function RouteMinimap({ robot, large = false }: { robot?: Robot | null; large?: boolean }) {
  const robots = useStore(state => state.robots), blockedEdges = useStore(state => state.blockedEdges);
  const edges = Object.values(WAREHOUSE_LAYOUT.graph.edges);
  return <svg className={`route-minimap ${large ? 'large-minimap' : ''}`} viewBox="-1 -1 48 18" role="img" aria-label={robot ? `${robot.id} route preview in the warehouse` : 'Warehouse navigation graph and robot positions'}>
    <rect x="-.6" y="-.6" width="47.2" height="17.2" rx=".8" fill="#101b27" stroke="#334355" strokeWidth=".15" />
    {WAREHOUSE_LAYOUT.racks.map(rack => <rect key={rack.id} x={rack.y - rack.depth / 2} y={rack.x - rack.width / 2} width={rack.depth} height={rack.width} rx=".15" fill="#1d2d3c" stroke="#314152" strokeWidth=".08" />)}
    {edges.map(edge => { const from = WAREHOUSE_LAYOUT.graph.nodes[edge.from], to = WAREHOUSE_LAYOUT.graph.nodes[edge.to]; return <line key={edge.id} x1={from.y} y1={from.x} x2={to.y} y2={to.x} stroke={blockedEdges.includes(edge.id) || blockedEdges.includes(edge.resourceId) ? '#eb7272' : '#3c5361'} strokeWidth={edge.narrow ? '.1' : '.14'} strokeDasharray={blockedEdges.includes(edge.id) ? '.4 .2' : undefined} />; })}
    {WAREHOUSE_LAYOUT.resources.map(resource => <circle key={resource.id} cx={resource.y} cy={resource.x} r={resource.kind === 'charger' ? '.25' : '.48'} fill="#142d32" stroke="#4f9a88" strokeWidth=".12" />)}
    {robot?.route.length ? <polyline points={robot.route.map(step => `${step.y},${step.x}`).join(' ')} fill="none" stroke="#f0d17d" strokeWidth=".22" strokeLinecap="round" strokeLinejoin="round" /> : null}
    {WAREHOUSE_LAYOUT.stations.filter(station => station.kind !== 'staging').map(station => <rect key={station.id} x={station.y - .2} y={station.x - .2} width=".4" height=".4" fill={station.kind === 'charging' ? '#e3b965' : '#76c7a9'} />)}
    {Object.values(robots).map(unit => <circle key={unit.id} cx={unit.position.y} cy={unit.position.x} r={unit.id === robot?.id ? '.42' : '.22'} fill={unit.failed ? '#ec7174' : unit.id === robot?.id ? '#28d3e0' : '#619a91'} stroke="#0c1a25" strokeWidth=".1" />)}
    {robot?.route.at(-1) && <rect x={robot.route.at(-1)!.y - .4} y={robot.route.at(-1)!.x - .4} width=".8" height=".8" rx=".12" fill="none" stroke="#efd27a" strokeWidth=".18" />}
  </svg>;
}
