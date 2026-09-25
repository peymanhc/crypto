import React from 'react';
import AnimatedNumber from './AnimatedNumber';

interface StatProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  tone?: 'neutral' | 'good' | 'bad' | 'auto';
  hint?: string;
  icon?: React.ReactNode;
}

// One KPI tile: label on top, a big animated number, optional hint under it
const Stat: React.FC<StatProps> = ({ label, value, format, tone = 'neutral', hint, icon }) => {
  const resolved = tone === 'auto' ? (value > 0 ? 'good' : value < 0 ? 'bad' : 'neutral') : tone;
  const color = resolved === 'good' ? 'text-long' : resolved === 'bad' ? 'text-short' : 'text-white';
  return (
    <div className="glass glass-hover p-3.5 sm:p-4">
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className={`relative mt-1.5 font-display text-2xl font-semibold leading-none sm:text-[26px] ${color}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      {hint && <p className="relative mt-1.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
};

export default Stat;
