import { LayoutDashboard, ListChecks, Wrench, Check } from 'lucide-react';
import { EngineId } from '../../types/strategy';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';

interface EngineSelectorProps {
  engine: EngineId;
  onChange: (engine: EngineId) => void;
  // Small status line under each option, e.g. "3 enabled"
  simpleStatus: string;
  proStatus: string;
}

// Three cards: which engine decides the signals on these tabs
const EngineSelector: React.FC<EngineSelectorProps> = ({ engine, onChange, simpleStatus, proStatus }) => {
  const { t } = useI18n();
  const options: { id: EngineId; icon: React.ReactNode; status?: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'simple', icon: <ListChecks className="h-4 w-4" />, status: simpleStatus },
    { id: 'pro', icon: <Wrench className="h-4 w-4" />, status: proStatus },
  ];

  return (
    <Card title={t('engine.title')} icon={<Check className="h-4 w-4" />} hover={false}>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t('engine.hint')}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const active = option.id === engine;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`relative rounded-xl border p-3 text-start transition-all ${
                active ? 'border-glow-cyan/50 bg-glow-cyan/10 shadow-[0_0_30px_-12px_rgba(34,211,238,0.8)]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${active ? 'bg-glow-cyan/20 text-glow-cyan' : 'bg-white/[0.06] text-slate-400'}`}>{option.icon}</span>
                  {t(`engine.${option.id}`)}
                </span>
                {active && <span className="chip border-glow-cyan/40 bg-glow-cyan/15 text-glow-cyan">{t('engine.active')}</span>}
              </span>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">{t(`engine.${option.id}Desc`)}</span>
              {option.status && <span className="mt-1 block text-[10px] text-slate-400">{option.status}</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default EngineSelector;
