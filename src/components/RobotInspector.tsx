import React from 'react';
import { useStore } from '../store';
import { MotionPath } from '../simulation/motionPath';

export const RobotInspector: React.FC = () => {
  const { selectedRobotId, robots, tasks } = useStore();
  const robot = selectedRobotId ? robots[selectedRobotId] : null;
  const task = robot?.taskId ? tasks[robot.taskId] : null;
  const queue = Object.values(tasks).filter(item => item.status === 'QUEUED');
  const route = robot?.route ?? [];
  const routeSegments = route.length ? new MotionPath(route.map(step => ({ x: step.x, y: step.y })), 0).segments.length : 0;
  const first = route[0]?.nodeId.replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '').replaceAll('_', ' ') ?? 'Route pending';
  const last = route.at(-1)?.nodeId.replace('_', ' ') ?? 'Route pending';

  return <div className="h-full overflow-y-auto bg-[#050c13] px-[clamp(16px,1.35vw,28px)] py-[clamp(22px,3vh,40px)] text-[#e2eaf0]">
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a]">Robot inspector</h2>
        {robot && <span className="font-mono text-[11px] text-[#dce7ed]">{robot.id}</span>}
      </div>
      {!robot ? <div className="py-5 text-[12px] text-[#8295a4]">Select an AMR on the floorplan to inspect its state and route.</div> : <>
        <div className="text-[18px] leading-tight font-light capitalize">{robot.state.replaceAll('_', ' ').toLowerCase()}</div>
        <div className="mt-1 mb-6 text-[10px] uppercase tracking-[0.13em] text-[#55b8f5]">{task?.id ?? 'No active task'}</div>
        <div className="grid grid-cols-2 gap-y-4 pb-5 border-b border-[#20313e]">
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">Battery model</div><div className="mt-1 text-[17px] font-light">{robot.battery.toFixed(1)}<small className="text-[11px] text-[#8295a4]">%</small></div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">Payload</div><div className="mt-1 text-[13px]">{robot.payload ? 'Loaded' : 'Empty'}</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">Speed</div><div className="mt-1 font-mono text-[12px]">{robot.velocity.toFixed(1)} m/s</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">State dwell</div><div className="mt-1 font-mono text-[12px]">{robot.waitingTime.toFixed(1)} s</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">Distance</div><div className="mt-1 font-mono text-[12px]">{robot.distanceTraveled.toFixed(1)} m</div></div>
          <div><div className="text-[9px] uppercase tracking-wider text-[#71879a]">Path leg</div><div className="mt-1 font-mono text-[12px]">{route.length ? `${Math.min(routeSegments, robot.currentWaypointIndex + 1)} / ${routeSegments}` : 'Pending'}</div></div>
        </div>
        <div className="py-5 border-b border-[#20313e]">
          <h3 className="text-[9px] uppercase tracking-[0.18em] text-[#71879a] mb-4">Current task</h3>
          <div className="flex justify-between text-[11px] py-1"><span className="text-[#8295a4]">Task</span><span className="font-mono">{task?.id ?? 'Unassigned'}</span></div>
          <div className="flex justify-between text-[11px] py-1"><span className="text-[#8295a4]">Pickup</span><span>{task?.pickupNodeId.replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '') ?? 'Pending assignment'}</span></div>
          <div className="flex justify-between text-[11px] py-1"><span className="text-[#8295a4]">Destination</span><span>{task?.dropNodeId.replace('_', ' ') ?? 'Pending assignment'}</span></div>
        </div>
        <div className="py-5">
          <h3 className="text-[9px] uppercase tracking-[0.18em] text-[#71879a] mb-3">Route</h3>
          {route.length ? <div className="font-mono text-[11px] leading-6 text-[#a4b3bf]">{first}<span className="mx-2 text-[#526c7e]">→</span>{last}</div> : <div className="text-[11px] text-[#71879a]">No route assigned</div>}
          {route.length > 0 && <div className="mt-1 text-[9px] font-mono text-[#617889]">{route.length} graph nodes · selected path shown on map</div>}
        </div>
      </>}
    </section>
    <div className="h-px bg-[#20313e] my-5" />
    <section>
      <div className="flex justify-between items-center mb-4"><h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a]">Task queue</h2><span className="font-mono text-[10px] text-[#8295a4]">{queue.length}</span></div>
      {queue.length ? queue.map(item => <div key={item.id} className="py-3 border-b border-[#172733] last:border-0">
        <div className="flex justify-between text-[11px]"><span className="font-mono text-[#dce7ed]">{item.id}</span><span className="text-[#8295a4]">P{item.priority}</span></div>
        <div className="mt-1 text-[10px] text-[#71879a]">{item.pickupNodeId.replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '')} → {item.dropNodeId.replace('_', ' ')}</div>
      </div>) : <div className="text-[11px] text-[#71879a]">No queued work</div>}
    </section>
  </div>;
};
