import { BacktestExitMode } from '../../types/backtest';
import Field from '../ui/Field';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

interface ExitRulePickerProps {
  value: BacktestExitMode;
  disabled?: boolean;
  onChange: (mode: BacktestExitMode) => void;
}

const EXIT_MODES: { value: BacktestExitMode; label: TranslationKey; hint: TranslationKey }[] = [
  { value: 'profit', label: 'bt.exit.profit', hint: 'bt.exit.profitHint' },
  { value: 'tp1', label: 'bt.exit.tp1', hint: 'bt.exit.tp1Hint' },
  { value: 'tpFinal', label: 'bt.exit.tpFinal', hint: 'bt.exit.tpFinalHint' },
];

// Label of an exit mode in the current language (also used by the auto-fill summary)
export const exitModeLabel = (mode: BacktestExitMode, t: ReturnType<typeof useI18n>['t']): string =>
  t(EXIT_MODES.find((m) => m.value === mode)?.label ?? 'bt.exit.profit');

// Three radio-style buttons for how a simulated trade takes profit
const ExitRulePicker: React.FC<ExitRulePickerProps> = ({ value, disabled, onChange }) => {
  const { t } = useI18n();
  const current = EXIT_MODES.find((m) => m.value === value);
  return (
  <Field label={t('bt.exitRule')} hint={current ? t(current.hint) : undefined}>
    <div className="grid grid-cols-1 gap-1">
      {EXIT_MODES.map((mode) => {
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode.value)}
            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-start text-xs transition-all ${
              active ? 'border-glow-cyan/50 bg-glow-cyan/10 text-white' : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20'
            }`}
          >
            {t(mode.label)}
            <span className={`h-2 w-2 rounded-full ${active ? 'bg-glow-cyan shadow-[0_0_10px_#22d3ee]' : 'bg-white/10'}`} />
          </button>
        );
      })}
    </div>
  </Field>
  );
};

export default ExitRulePicker;
