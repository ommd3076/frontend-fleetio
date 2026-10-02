import { BatteryCharging, MapPin } from 'lucide-react';
import { useStore } from '../store';
import type { Robot } from '../types';
import { DOCKS, dockStatusLabel, getDockStatus, getRobotHomeDock } from './scene/docks';

const tones = { ready: 'muted', occupied: 'green', charging: 'amber', fault: 'red' };

export function HomeDockInformation({ robot }: { robot: Robot }) {
  const robots = useStore(state => state.robots);
  const dock = getRobotHomeDock(robot);
  if (!dock) return null;
  const status = getDockStatus(dock, robots);
  return <section className="inspector-section home-dock-info" aria-label={`${robot.id} home dock`}>
    <div className="card-heading"><h3><BatteryCharging size={14} /> Home Dock</h3><span className={`state-badge ${tones[status.state]}`}>{dockStatusLabel(status.state)}</span></div>
    <p>{dock.label}<small>{status.robotId ? `Occupied by ${status.robotId}` : 'Ready for return'}</small></p>
    <button className="button full-width" onClick={() => { const state = useStore.getState(); state.focusNode(dock.nodeId); state.setSelectedRobot(robot.id); }}><MapPin size={14} />Locate Home Dock</button>
    <span className="dock-note">Home docks show parking. Battery replenishes at Charge 1 or Charge 2.</span>
  </section>;
}

export function DockDirectory() {
  const robots = useStore(state => state.robots);
  return <div className="dock-directory" aria-label="Home docks and charging stations">{DOCKS.map(dock => {
    const status = getDockStatus(dock, robots);
    return <button className="dock-resource" key={dock.id} data-dock-id={dock.id} data-dock-state={status.state} onClick={() => {
      const state = useStore.getState(); state.focusNode(dock.nodeId); state.setSelectedRobot(status.robotId ?? dock.ownerRobotId);
    }}><BatteryCharging size={15} /><span><strong>{dock.label}</strong><small>{dock.kind === 'home' ? 'Home dock' : 'Exclusive charger'}{status.robotId ? ` · ${status.robotId}` : ''}</small></span><span className={`state-badge ${tones[status.state]}`}>{dockStatusLabel(status.state)}</span></button>;
  })}</div>;
}
