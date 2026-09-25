import { X } from 'lucide-react';
import { Rule, RuleType } from '../../types/strategy';
import { RULE_DEFS, RULE_TYPES, defaultParams } from '../../lib/strategies/rules';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

interface RuleRowProps {
  rule: Rule;
  onChange: (rule: Rule) => void;
  onRemove: () => void;
}

// One rule in the editor: its type, its numeric settings and its weight
const RuleRow: React.FC<RuleRowProps> = ({ rule, onChange, onRemove }) => {
  const { t } = useI18n();
  const params = RULE_DEFS[rule.type].params;

  const changeType = (type: RuleType) => onChange({ ...rule, type, params: defaultParams(type) });
  const changeParam = (key: string, value: number) => onChange({ ...rule, params: { ...rule.params, [key]: value } });

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <select value={rule.type} onChange={(e) => changeType(e.target.value as RuleType)} className="field min-w-0 flex-1 !py-1.5 text-xs">
          {RULE_TYPES.map((type) => (
            <option key={type} value={type}>{t(`rule.${type}` as TranslationKey)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-slate-400">
          {t('builder.weight')}
          <input type="number" min={1} max={5} step={1} value={rule.weight} onChange={(e) => onChange({ ...rule, weight: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} className="field !w-14 !px-1.5 !py-1 text-[11px]" />
        </label>
        <button type="button" onClick={onRemove} className="btn-ghost !p-1.5" aria-label={t('builder.delete')}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {params.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {params.map((param) => (
            <label key={param.key} className="flex items-center gap-1 text-[11px] text-slate-400">
              {t(`param.${param.key}` as TranslationKey)}
              <input
                type="number"
                min={param.min}
                max={param.max}
                step={param.step}
                value={rule.params[param.key] ?? param.default}
                onChange={(e) => changeParam(param.key, Math.min(param.max, Math.max(param.min, Number(e.target.value) || param.default)))}
                className="field !w-16 !px-1.5 !py-1 text-[11px]"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default RuleRow;
