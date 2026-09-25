import React from 'react';
import { useStore } from '../store';

export const EventFeed: React.FC = () => {
  const events = useStore(state => state.events);
  const simulationStatus = useStore(state => state.simulationStatus);
  const formatTime = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toFixed(1).padStart(4, '0')}`;
  return <div className="h-full flex flex-col px-[clamp(14px,1.2vw,26px)] py-3 bg-[#050c13] overflow-hidden">
    <div className="flex items-center justify-between pb-2 border-b border-[#20313e] shrink-0">
      <h2 className="text-[9px] uppercase tracking-[0.2em] text-[#71879a]">Live event log</h2>
      <span className="text-[9px] font-mono uppercase tracking-wider text-[#607788]">Simulation time · mm:ss</span>
    </div>
    <div className="grid grid-cols-[72px_58px_minmax(0,1fr)] md:grid-cols-[72px_58px_minmax(0,1fr)_90px] gap-x-3 py-1.5 text-[8px] uppercase tracking-[0.16em] text-[#607788] shrink-0">
      <span>Time</span><span>Unit</span><span>Event</span><span className="hidden md:block text-right">State</span>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {events.slice(0, 8).map((event, index) => {
        const [actor, ...message] = event.text.split(' ');
        const eventText = message.join(' ');
        const active = /picked|arrived|delivered|routing/i.test(eventText);
        return <div key={`${event.id}-${index}`} className="grid grid-cols-[72px_58px_minmax(0,1fr)] md:grid-cols-[72px_58px_minmax(0,1fr)_90px] gap-x-3 py-[5px] border-t border-[#14232e] text-[10px] font-mono">
          <span className="text-[#6d8292]">{formatTime(event.time)}</span><span className="text-[#68c5f3]">{actor}</span><span className="truncate text-[#b5c2ca]">{eventText}</span><span className={`hidden md:block text-right uppercase text-[8px] tracking-wider ${active ? 'text-[#54c69e]' : 'text-[#71879a]'}`}>{active ? 'Recorded' : 'Info'}</span>
        </div>;
      })}
      {events.length === 0 && <div className="py-3 text-[10px] text-[#71879a]">
        {simulationStatus === 'RUNNING' ? 'Waiting for the first worker event.' : 'Simulation stopped · press Play to start the event stream.'}
      </div>}
    </div>
  </div>;
};
