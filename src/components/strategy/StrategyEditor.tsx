import { Plus, Wrench } from 'lucide-react';
import { CustomStrategy, RuleType } from '../../types/strategy';
import { newRule } from '../../lib/strategies/rules';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Field from '../ui/Field';
import RuleRow from './RuleRow';

interface StrategyEditorProps {
  strategy: CustomStrategy;
  onChange: (strategy: CustomStrategy) => void;
}

// Edits one strategy: its name, the score it needs, and its list of rules
const StrategyEditor: React.FC<StrategyEditorProps> = ({ strategy, onChange }) => {
  const { t } = useI18n();
  const maxScore = strategy.rules.reduce((sum, r) => sum + r.weight, 0);

  const addRule = (type: RuleType = 'smaCross') => onChange({ ...strategy, rules: [...strategy.rules, newRule(type)] });
  const setRule = (index: number, rule: CustomStrategy['rules'][number]) =>
    onChange({ ...strategy, rules: strategy.rules.map((r, i) => (i === index ? rule : r)) });
  const removeRule = (index: number) => onChange({ ...strategy, rules: strategy.rules.filter((_, i) => i !== index) });

  return (
    <Card title={strategy.name || t('builder.new')} icon={<Wrench className="h-4 w-4" />} hover={false}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label={t('builder.name')}>
            <input type="text" value={strategy.name} onChange={(e) => onChange({ ...strategy, name: e.target.value })} placeholder={t('builder.namePlaceholder')} className="field !py-1.5 text-xs" />
          </Field>
          <Field label={t('builder.minScore')} hint={t('builder.minScoreHint', { max: maxScore })}>
            <input type="number" min={1} max={Math.max(1, maxScore)} step={1} value={strategy.minScore} onChange={(e) => onChange({ ...strategy, minScore: Math.max(1, Number(e.target.value) || 1) })} className="field !py-1.5 text-xs" />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label !mb-0">{t('builder.rules')}</span>
            <button type="button" onClick={() => addRule()} className="btn-ghost !py-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t('builder.addRule')}
            </button>
          </div>
          {strategy.rules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">{t('builder.noRules')}</p>
          ) : (
            <div className="space-y-2">
              {strategy.rules.map((rule, index) => (
                <RuleRow key={rule.id} rule={rule} onChange={(r) => setRule(index, r)} onRemove={() => removeRule(index)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default StrategyEditor;
