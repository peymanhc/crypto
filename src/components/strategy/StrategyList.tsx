import { Plus, Copy, Trash2, Check, Layers } from 'lucide-react';
import { CustomStrategy } from '../../types/strategy';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';

interface StrategyListProps {
  strategies: CustomStrategy[];
  activeId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetActive: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

// The saved strategies: click to edit, "Use" to make one the active engine
const StrategyList: React.FC<StrategyListProps> = ({ strategies, activeId, selectedId, onSelect, onSetActive, onCreate, onDuplicate, onDelete }) => {
  const { t } = useI18n();
  return (
    <Card
      title={t('builder.strategies')}
      icon={<Layers className="h-4 w-4" />}
      hover={false}
      right={
        <button type="button" onClick={onCreate} className="btn-primary !py-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> {t('builder.new')}
        </button>
      }
    >
      {strategies.length === 0 ? (
        <p className="text-xs text-slate-500">{t('builder.empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {strategies.map((strategy) => {
            const selected = strategy.id === selectedId;
            const active = strategy.id === activeId;
            return (
              <div key={strategy.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${selected ? 'border-glow-cyan/40 bg-glow-cyan/[0.07]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <button type="button" onClick={() => onSelect(strategy.id)} className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-sm font-medium text-white">{strategy.name || t('builder.new')}</span>
                  <span className="block text-[10px] text-slate-500">{t('builder.rulesCount', { count: strategy.rules.length })}</span>
                </button>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => onSetActive(strategy.id)} className={`btn !rounded-md !px-2 !py-1 text-[10px] ${active ? 'border-long/40 bg-long/15 text-long' : 'btn-ghost'}`}>
                    {active && <Check className="h-3 w-3" />}
                    {active ? t('builder.activeStrategy') : t('builder.setActive')}
                  </button>
                  <button type="button" onClick={() => onDuplicate(strategy.id)} className="btn-ghost !p-1.5" title={t('builder.duplicate')} aria-label={t('builder.duplicate')}>
                    <Copy className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => onDelete(strategy.id)} className="btn-danger !p-1.5" title={t('builder.delete')} aria-label={t('builder.delete')}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default StrategyList;
