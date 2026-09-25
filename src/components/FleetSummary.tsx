import React from 'react';
import { useStore } from '../store';

export const FleetSummary: React.FC = () => {
  const { robots, tasks, metrics } = useStore();
  const fleet = Object.values(robots);
  const total = fleet.length;
  const active = fleet.filter(robot => !['IDLE', 'CHARGING', 'WAITING'].includes(robot.state)).length;
  const idle = fleet.filter(robot => robot.state === 'IDLE').length;
  const waiting = fleet.filter(robot => robot.state === 'WAITING').length;
  const completed = Object.values(tasks).filter(task => task.status === 'COMPLETED').length;
  const queued = Object.values(tasks).filter(task => task.status === 'QUEUED').length;
  const utilization = total ? Math.round(active / total * 100) : 0;

  return <div className="h-full overflow-y-auto bg-[#050c13] px-[clamp(16px,1.35vw,28px)] py-[clamp(22px,3vh,40px)] text-[#e2eaf0]">
    <section>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a] mb-6">Fleet status</h2>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-[clamp(27px,1.7vw,38px)] leading-none font-light tracking-tight">{total}<span className="text-[#4f6475]"> / {total}</span></span>
      </div>
      <div className="text-[10px] tracking-[0.16em] text-[#55b8f5] uppercase mb-6">Units in simulation</div>
      <div className="space-y-2.5 text-[12px]">
        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#52d6a1]"/><span className="font-mono w-5">{active}</span><span className="text-[#8295a4]">Active</span></div>
        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#71879a]"/><span className="font-mono w-5">{idle}</span><span className="text-[#8295a4]">Idle</span></div>
        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#efb94f]"/><span className="font-mono w-5">{waiting}</span><span className="text-[#8295a4]">Waiting</span></div>
      </div>
    </section>
    <div className="h-px bg-[#20313e] my-[clamp(22px,3vh,38px)]" />
    <section>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a] mb-4">Utilization</h2>
      <div className="text-[clamp(27px,1.7vw,38px)] leading-none font-light">{utilization}<span className="text-[18px] text-[#8295a4]">%</span></div>
      <div className="mt-3 h-[2px] bg-[#142330]"><div className="h-full bg-[#52baf4] transition-all" style={{ width: `${utilization}%` }} /></div>
    </section>
    <div className="h-px bg-[#20313e] my-[clamp(22px,3vh,38px)]" />
    <section>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a] mb-5">Task flow</h2>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between"><span className="text-[22px] font-light">{completed}</span><span className="text-[11px] text-[#8295a4]">Completed</span></div>
        <div className="flex items-baseline justify-between"><span className="text-[22px] font-light">{queued}</span><span className="text-[11px] text-[#8295a4]">Queued</span></div>
        <div className="flex items-baseline justify-between"><span className="text-[22px] font-light">{metrics.avgTaskTime.toFixed(1)}<small className="text-[12px] text-[#8295a4]">s</small></span><span className="text-[11px] text-[#8295a4]">Average cycle</span></div>
      </div>
    </section>
    <div className="h-px bg-[#20313e] my-[clamp(22px,3vh,38px)]" />
    <section>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#71879a] mb-5">Coordination</h2>
      <div className="space-y-3 font-mono text-[11px]">
        <div className="flex justify-between"><span className="text-[#8295a4]">Future map</span><span className="text-[#63c8f4]">3.0 s</span></div>
        <div className="flex justify-between"><span className="text-[#8295a4]">DL resolved</span><span className="text-[#e2eaf0]">{metrics.deadlocksResolved}</span></div>
        <div className="flex justify-between"><span className="text-[#8295a4]">Min separation</span><span className="text-[#e2eaf0]">{metrics.minimumSeparation ? `${metrics.minimumSeparation.toFixed(2)} m` : '—'}</span></div>
        <div className="flex justify-between"><span className="text-[#8295a4]">Overlap alerts</span><span className={metrics.overlapViolations ? 'text-[#f07178]' : 'text-[#52d6a1]'}>{metrics.overlapViolations}</span></div>
      </div>
    </section>
    <div className="mt-8 pt-4 border-t border-[#20313e] text-[9px] font-mono tracking-wider text-[#62798b] uppercase">{total} unit run <span className="text-[#3f5667]">/</span> Concurrent simulation</div>
  </div>;
};
