import { ArrowRight, Radio, AlertTriangle, Crosshair, Bot } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { RobotPreview } from './scene/RobotPreview';
import { RouteMinimap } from './RouteMinimap';
import { KeyValue, StateBadge } from './DashboardPrimitives';
import { nodeLabel, stateLabel } from './dashboardFormatting';

function JecInspector() {
  const { jec, windows, sendCommand, setSelectedRobot } = useStore(useShallow(state => ({ jec: state.jecs.find(item => item.id === state.selectedJecId), windows: state.reservationWindows, sendCommand: state.sendCommand, setSelectedRobot: state.setSelectedRobot })));
  if (!jec) return null;
  const grant = windows.find(window => window.resourceId === jec.resourceId);
  return <div className="rail-content jec-inspector"><div className="inspector-heading"><h2>{jec.id}</h2><span className={`state-badge ${jec.online ? 'green' : 'amber'}`}>{jec.online ? 'Online' : 'Peer fallback'}</span></div><p className="inspector-state">Junction Edge Cell</p><div className="jec-art"><Radio size={46} /><span>{jec.resourceId}</span></div><KeyValue label="Resource" value={jec.resourceId} /><KeyValue label="Authority" value={jec.online ? 'JEC' : 'Peers'} /><KeyValue label="Generation" value={jec.generation} /><KeyValue label="Occupancy" value={jec.occupancy.length ? jec.occupancy.join(', ') : 'Clear'} /><KeyValue label="Reservation" value={jec.reservation ?? 'None'} /><KeyValue label="Congestion" value={typeof jec.congestion === 'number' ? jec.congestion.toFixed(1) : '—'} />{grant && <KeyValue label="Window" value={`${grant.start.toFixed(1)}–${grant.end.toFixed(1)}s`} />}<button className="button full-width" onClick={() => sendCommand({ type: jec.online ? 'DISABLE_JEC' : 'ENABLE_JEC', jecId: jec.id })}>{jec.online ? 'Disable JEC' : 'Restore JEC'}<ArrowRight size={14} /></button><div className="inspector-section"><h3>Incoming Robots</h3>{jec.incoming.length ? jec.incoming.map(item => <button key={item.robotId} className="incoming-row" onClick={() => setSelectedRobot(item.robotId)}><Bot size={14} /><strong>{item.robotId}</strong><span>{item.eta.toFixed(1)}s</span><ArrowRight size={12} /></button>) : <p className="subtle">No approaching robots.</p>}</div><div className="inspector-section"><h3>Waiting Queue</h3>{jec.queue.length ? jec.queue.map((id, index) => <button className="incoming-row" key={id} onClick={() => setSelectedRobot(id)}><span>{index + 1}</span><strong>{id}</strong><ArrowRight size={12} /></button>) : <p className="subtle">Queue clear.</p>}</div></div>;
}
function RobotDetails() {
  const robot = useStore(state => state.selectedRobotId ? state.robots[state.selectedRobotId] : undefined);
  const task = useStore(state => { const current = state.selectedRobotId ? state.robots[state.selectedRobotId] : undefined; return current?.taskId ? state.tasks[current.taskId] : undefined; });
  const setActiveView = useStore(state => state.setActiveView), setCamera = useStore(state => state.setCamera), sendCommand = useStore(state => state.sendCommand);
  if (!robot) return <div className="rail-content inspector-empty"><Bot size={34} /><h2>Robot Inspector</h2><p>Select a robot in the warehouse to inspect its task, route and condition.</p></div>;
  return <div className="rail-content robot-inspector"><div className="inspector-heading"><h2>{robot.id}</h2><StateBadge state={robot.state} /></div><p className="inspector-state">{stateLabel(robot.state)}</p><div className="robot-preview"><RobotPreview robot={robot} /></div>
    <div className="battery-row"><span>Battery</span><strong>{robot.battery.toFixed(0)}%</strong></div><div className="battery-track"><div className={robot.battery < 20 ? 'low' : ''} style={{ width: `${Math.max(0, Math.min(100, robot.battery))}%` }} /></div>
    <div className="robot-details"><KeyValue label="Speed" value={`${robot.velocity.toFixed(1)} m/s`} /><KeyValue label="Current Task" value={task?.id ?? '—'} /><KeyValue label="From" value={nodeLabel(task?.pickupNodeId)} /><KeyValue label="To" value={nodeLabel(task?.dropNodeId ?? (robot.state === 'RETURNING_TO_STAGING' ? robot.homeNodeId : null))} /><KeyValue label="ETA" value={robot.eta === null ? '—' : `${robot.eta.toFixed(0)} s`} /><KeyValue label="Total Tasks" value={robot.tasksCompleted} /><KeyValue label="Wait Time" value={`${robot.waitingTime.toFixed(1)} s`} /><KeyValue label="Payload" value={robot.payload ? 'Carrying package' : 'Empty'} /></div>
    {robot.waitReason && <div className={`wait-reason ${robot.failed ? 'failure-reason' : ''}`}><AlertTriangle size={14} /><span>{robot.waitReason}</span></div>}
    <button className="button full-width details-button" onClick={() => setActiveView('Robots')}>View Full Details<ArrowRight size={15} /></button>
    <div className="inspector-section"><div className="card-heading"><h3>Route Preview</h3><button className="icon-button" title="Follow this robot" aria-label={`Follow ${robot.id}`} onClick={() => setCamera('follow')}><Crosshair size={14} /></button></div><RouteMinimap robot={robot} /><div className="minimap-legend"><span><i className="cyan" />Current</span><span><i className="green" />Resources</span><span><i className="amber" />Destination</span></div></div>
    <div className="inspector-section robot-actions"><button className={`button full-width ${robot.failed ? 'green-button' : 'danger-soft'}`} onClick={() => sendCommand({ type: robot.failed ? 'RECOVER_ROBOT' : 'FAIL_ROBOT', robotId: robot.id })}>{robot.failed ? 'Recover Robot' : 'Simulate Robot Failure'}</button></div>
  </div>;
}
export function RobotInspector() { const selectedJecId = useStore(state => state.selectedJecId); return selectedJecId ? <JecInspector /> : <RobotDetails />; }
