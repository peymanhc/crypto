import { RiskLevel } from '../../types/trading';
import Field from '../ui/Field';
import { useI18n } from '../../i18n';

interface RiskLevelPickerProps {
  value: RiskLevel[];
  disabled?: boolean;
  onChange: (levels: RiskLevel[]) => void;
}

const LEVELS: { level: RiskLevel; color: string }[] = [
  { level: 'Low', color: 'text-long' },
  { level: 'Medium', color: 'text-glow-amber' },
  { level: 'High', color: 'text-short' },
];

// Checkboxes for which signal risk levels the simulation is allowed to trade
const RiskLevelPicker: React.FC<RiskLevelPickerProps> = ({ value, disabled, onChange }) => {
  const { t } = useI18n();
  const toggle = (level: RiskLevel, checked: boolean) => {
    const next = checked ? [...value, level] : value.filter((l) => l !== level);
    // Keep the Low / Medium / High order no matter the click order
    onChange(LEVELS.map((l) => l.level).filter((l) => next.includes(l)));
  };

  return (
    <Field label={t('bt.riskLevels')}>
      <div className="flex items-center gap-3 text-[11px]">
        {LEVELS.map(({ level, color }) => (
          <label key={level} className={`flex cursor-pointer items-center gap-1.5 ${color}`}>
            <input type="checkbox" className="checkbox" checked={value.includes(level)} disabled={disabled} onChange={(e) => toggle(level, e.target.checked)} />
            {t(`common.level.${level}`)}
          </label>
        ))}
      </div>
    </Field>
  );
};

export default RiskLevelPicker;
