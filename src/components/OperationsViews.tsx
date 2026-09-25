import React from 'react';
import { Activity, Bot, ClipboardList, MapPinned } from 'lucide-react';
import { useStore } from '../store';
import type { Robot, RobotState, Task } from '../types';
import { MotionPath } from '../simulation/motionPath';

const page = 'h-full overflow-auto bg-[#07111a] px-[clamp(20px,2.5vw,48px)] py-[clamp(22px,3vh,42px)]';
const label = 'text-[9px] uppercase tracking-[0.19em] text-[#71879a]';
const heading = 'text-[clamp(22px,1.5vw,30px)] font-light tracking-tight text-[#e2eaf0]';
const states: RobotState[] = ['IDLE', 'ASSIGNED', 'MOVING_TO_PICKUP', 'PICKING', 'MOVING_TO_DROPOFF', 'DROPPING', 'RETURNING_TO_STAGING', 'WAITING', 'CHARGING'];
const displayState = (state: RobotState) => state.toLowerCase().replaceAll('_', ' ');
const displayNode = (id: string) => id.replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '').replaceAll('_', ' ');

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return <div className="border-t border-[#20313e] pt-4">
    <div className={label}>{title}</div><div className="mt-3 text-[clamp(25px,2vw,40px)] font-light text-[#e5edf2]">{value}</div><div className="mt-1 text-[11px] text-[#72889a]">{detail}</div>
  </div>;
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-3"><div><div className={label}>AUTOFLEET / OPS</div><h1 className={`${heading} mt-2`}>{title}</h1></div><div className="font-mono text-[10px] uppercase tracking-wider text-[#607789]">{detail}</div></div>;
}

export function OverviewView() {
  const { robots, tasks, events, metrics, setActiveView, setSelectedRobot } = useStore();
  const fleet = Object.values(robots);
  const taskList = Object.values(tasks);
  const active = fleet.filter(robot => !['IDLE', 'CHARGING'].includes(robot.state));
  const completed = taskList.filter(task => task.status === 'COMPLETED');
  return <main className={page}>
    <SectionTitle title="Operations overview" detail="Current simulation state · Warehouse 01" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-7">
      <Metric title="Tracked units" value={fleet.length} detail={`${active.length} currently active`} />
      <Metric title="Tasks completed" value={completed.length} detail={`${taskList.filter(task => task.status === 'IN_PROGRESS').length} in progress`} />
      <Metric title="Tasks queued" value={taskList.filter(task => task.status === 'QUEUED').length} detail="Waiting for an available AMR" />
      <Metric title="Simulation time" value={`${metrics.simTime.toFixed(1)}s`} detail="Elapsed virtual time" />
    </div>
    <div className="mt-10 grid grid-cols-1 2xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)] gap-10">
      <section>
        <div className="flex items-center justify-between border-b border-[#20313e] pb-3"><h2 className={label}>Fleet activity</h2><button onClick={() => setActiveView('Fleet')} className="text-[10px] uppercase tracking-wider text-[#67bff2]">Open fleet →</button></div>
        {fleet.map(robot => <button key={robot.id} onClick={() => { setSelectedRobot(robot.id); setActiveView('Map'); }} className="w-full grid grid-cols-[70px_minmax(0,1fr)_minmax(90px,0.5fr)] items-center gap-4 py-4 border-b border-[#172733] text-left hover:bg-[#0b1924] px-2">
          <span className="font-mono text-[12px] text-[#dce7ed]">{robot.id}</span><span className="text-[11px] capitalize text-[#aebdc7]">{displayState(robot.state)}</span><span className="text-right font-mono text-[10px] text-[#72889a]">{robot.velocity.toFixed(1)} m/s</span>
        </button>)}
      </section>
      <section>
        <div className="border-b border-[#20313e] pb-3"><h2 className={label}>Recent events</h2></div>
        {events.slice(0, 7).map(event => <div key={event.id} className="grid grid-cols-[55px_42px_minmax(0,1fr)] gap-3 border-b border-[#172733] py-3 font-mono text-[10px]"><span className="text-[#607789]">{event.time.toFixed(1)}s</span><span className="text-[#68c5f3]">{event.text.split(' ')[0]}</span><span className="truncate text-[#aebdc7]">{event.text.split(' ').slice(1).join(' ')}</span></div>)}
      </section>
    </div>
  </main>;
}

export function FleetView() {
  const { robots, tasks, setSelectedRobot, setActiveView } = useStore();
  const fleet = Object.values(robots);
  const taskFor = (robot: Robot) => robot.taskId ? tasks[robot.taskId] : undefined;
  return <main className={page}>
    <SectionTitle title="Fleet" detail={`${fleet.length} units · Select a row to inspect`} />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-7 mb-10">
      <Metric title="Tracked units" value={fleet.length} detail="Present in worker state" />
      <Metric title="Moving" value={fleet.filter(robot => robot.state.startsWith('MOVING')).length} detail="Traveling between stations" />
      <Metric title="Working" value={fleet.filter(robot => ['PICKING', 'DROPPING'].includes(robot.state)).length} detail="Handling a package" />
      <Metric title="Idle" value={fleet.filter(robot => robot.state === 'IDLE').length} detail="Available for work" />
    </div>
    <div className="border-y border-[#20313e]">
      <div className="grid grid-cols-[65px_minmax(100px,1fr)_minmax(100px,1.2fr)_minmax(80px,.7fr)_70px_75px] gap-4 py-3 px-2 text-[8px] uppercase tracking-[0.16em] text-[#607789]"><span>Unit</span><span>State</span><span>Task / route</span><span>Payload</span><span>Battery</span><span className="text-right">Speed</span></div>
      {fleet.map(robot => {
        const task = taskFor(robot);
        return <button key={robot.id} onClick={() => { setSelectedRobot(robot.id); setActiveView('Map'); }} className="grid w-full grid-cols-[65px_minmax(100px,1fr)_minmax(100px,1.2fr)_minmax(80px,.7fr)_70px_75px] gap-4 items-center py-4 px-2 border-t border-[#172733] text-left hover:bg-[#0b1924]">
          <span className="font-mono text-[11px] text-[#e2eaf0]">{robot.id}</span><span className="text-[11px] capitalize text-[#aebdc7]">{displayState(robot.state)}</span><span className="min-w-0 truncate text-[10px] text-[#8398a8]">{task ? `${displayNode(task.pickupNodeId)} → ${displayNode(task.dropNodeId)}` : 'Awaiting assignment'}</span><span className="text-[10px] text-[#8398a8]">{robot.payload ? 'Loaded' : 'Empty'}</span><span className="font-mono text-[10px] text-[#aebdc7]">{robot.battery.toFixed(1)}%</span><span className="text-right font-mono text-[10px] text-[#aebdc7]">{robot.velocity.toFixed(1)}</span>
        </button>;
      })}
    </div>
    <div className="mt-6 text-[10px] text-[#607789]">Robot rows use live state from the browser simulation. Selecting a unit opens its map inspector.</div>
  </main>;
}

export function TasksView() {
  const { tasks, robots, metrics } = useStore();
  const taskList = Object.values(tasks).sort((a, b) => a.id.localeCompare(b.id));
  const statusText = (task: Task) => task.status.toLowerCase().replace('_', ' ');
  return <main className={page}>
    <SectionTitle title="Tasks" detail="Work orders · Live status" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-7 mb-10">
      <Metric title="Total work orders" value={taskList.length} detail="Loaded in this run" />
      <Metric title="In progress" value={taskList.filter(task => task.status === 'IN_PROGRESS').length} detail="Assigned to robots" />
      <Metric title="Completed" value={taskList.filter(task => task.status === 'COMPLETED').length} detail="Delivered to packing" />
      <Metric title="Queued" value={taskList.filter(task => task.status === 'QUEUED').length} detail="Awaiting assignment" />
    </div>
    <div className="border-y border-[#20313e]">
      <div className="grid grid-cols-[75px_minmax(100px,.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_100px_100px] gap-4 py-3 px-2 text-[8px] uppercase tracking-[0.16em] text-[#607789]"><span>Task</span><span>Status</span><span>Pickup</span><span>Destination</span><span>Robot</span><span className="text-right">Duration</span></div>
      {taskList.map(task => <div key={task.id} className="grid grid-cols-[75px_minmax(100px,.7fr)_minmax(130px,1fr)_minmax(130px,1fr)_100px_100px] gap-4 items-center py-4 px-2 border-t border-[#172733] text-[10px]">
        <span className="font-mono text-[#e2eaf0]">{task.id}</span><span className="capitalize text-[#aebdc7]">{statusText(task)}</span><span className="text-[#8398a8]">{displayNode(task.pickupNodeId)}</span><span className="text-[#8398a8]">{displayNode(task.dropNodeId)}</span><span className="font-mono text-[#68c5f3]">{task.assignedRobotId ?? 'Unassigned'}</span><span className="text-right font-mono text-[#8398a8]">{task.completedAt !== null ? `${(task.completedAt - task.createdAt).toFixed(1)}s` : task.status === 'IN_PROGRESS' ? `${Math.max(0, metrics.simTime - task.createdAt).toFixed(1)}s` : 'Waiting'}</span>
      </div>)}
    </div>
  </main>;
}

export function AnalyticsView() {
  const { robots, tasks, events, metrics } = useStore();
  const taskList = Object.values(tasks);
  const completed = taskList.filter(task => task.completedAt !== null);
  const durations = completed.map(task => (task.completedAt! - task.createdAt));
  const average = durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null;
  const taskProgress = taskList.map(task => {
    const robot = task.assignedRobotId ? robots[task.assignedRobotId] : null;
    if (task.status === 'COMPLETED') return { task, robot, value: 100, detail: 'Delivered' };
    if (!robot?.route.length) return { task, robot, value: 0, detail: 'Awaiting assignment' };
    const path = new MotionPath(robot.route.map(step => ({ x: step.x, y: step.y })), 0);
    const value = path.totalLength ? Math.min(100, robot.pathProgress / path.totalLength * 100) : 0;
    return { task, robot, value, detail: `${displayState(robot.state)} · current route leg` };
  });
  const stateCounts = states.map(state => ({ state, count: Object.values(robots).filter(robot => robot.state === state).length })).filter(row => row.count > 0);
  return <main className={page}>
    <SectionTitle title="Analytics" detail="Derived from this simulation run" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-7">
      <Metric title="Completed orders" value={completed.length} detail="Successfully delivered" />
      <Metric title="Average cycle time" value={average === null ? 'Pending' : `${average.toFixed(1)}s`} detail={average === null ? 'Calculated after first delivery' : 'Creation to delivery'} />
      <Metric title="Fleet active" value={`${Object.values(robots).filter(robot => !['IDLE', 'CHARGING'].includes(robot.state)).length} / ${Object.keys(robots).length}`} detail="Current utilization snapshot" />
      <Metric title="Events recorded" value={events.length} detail="Latest simulation history" />
    </div>
    <div className="mt-10 grid grid-cols-1 2xl:grid-cols-2 gap-12">
      <section>
        <h2 className={`${label} border-b border-[#20313e] pb-3`}>Work-order progress</h2>
        <div className="pt-3">{taskProgress.map(({ task, robot, value, detail }) => <div key={task.id} className="py-4 border-b border-[#172733]">
          <div className="flex items-center justify-between"><div><span className="font-mono text-[10px] text-[#dce7ed]">{task.id}</span><span className="ml-3 text-[9px] text-[#6f8595]">{robot?.id ?? 'Unassigned'}</span></div><span className="font-mono text-[10px] text-[#9fb0bb]">{value.toFixed(0)}%</span></div>
          <div className="mt-2 h-[2px] bg-[#142330]"><div className="h-full bg-[#2c93c5] transition-all" style={{ width: `${value}%` }} /></div>
          <div className="mt-2 text-[9px] capitalize text-[#607789]">{detail}</div>
        </div>)}</div>
      </section>
      <section>
        <h2 className={`${label} border-b border-[#20313e] pb-3`}>Current robot states</h2>
        <div className="pt-3">{stateCounts.map(row => <div key={row.state} className="grid grid-cols-[minmax(120px,1fr)_40px_2fr] items-center gap-4 py-3 border-b border-[#172733]"><span className="text-[10px] capitalize text-[#aebdc7]">{displayState(row.state)}</span><span className="font-mono text-[10px] text-[#dce7ed]">{row.count}</span><div className="h-[2px] bg-[#142330]"><div className="h-full bg-[#45a9dc]" style={{ width: `${Object.keys(robots).length ? row.count / Object.keys(robots).length * 100 : 0}%` }} /></div></div>)}</div>
        <div className="mt-5 text-[9px] text-[#607789]">Simulation time {metrics.simTime.toFixed(1)} s · No forecast or production telemetry is included.</div>
      </section>
    </div>
  </main>;
}

export const ViewIcon = ({ name }: { name: string }) => {
  const Icon = name === 'Overview' ? Activity : name === 'Fleet' ? Bot : name === 'Tasks' ? ClipboardList : name === 'Map' ? MapPinned : Activity;
  return <Icon size={13} strokeWidth={1.6} />;
};
