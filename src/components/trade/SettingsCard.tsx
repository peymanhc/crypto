import { SlidersHorizontal } from 'lucide-react';
import { HlSettings, HlTakeProfitMode } from '../../types/hyperliquid';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Field from '../ui/Field';

interface SettingsCardProps {
  settings: HlSettings;
  onChange: <K extends keyof HlSettings>(key: K, value: HlSettings[K]) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// How big each Hyperliquid trade is and which take profit closes it
const SettingsCard: React.FC<SettingsCardProps> = ({ settings, onChange }) => {
  const { t } = useI18n();
  return (
    <Card title={t('hl.settings.title')} icon={<SlidersHorizontal className="h-4 w-4" />} hover={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('hl.settings.margin')} hint={t('hl.settings.marginHint')}>
            <input type="number" min={5} max={100000} step={5} value={settings.marginUsd} onChange={(e) => onChange('marginUsd', clamp(Number(e.target.value) || 5, 5, 100000))} className="field !py-1.5 text-xs" />
          </Field>
          <Field label={t('hl.settings.maxLeverage')} hint={t('hl.settings.maxLeverageHint')}>
            <input type="number" min={1} max={50} step={1} value={settings.maxLeverage} onChange={(e) => onChange('maxLeverage', clamp(Math.round(Number(e.target.value) || 1), 1, 50))} className="field !py-1.5 text-xs" />
          </Field>
          <Field label={t('hl.settings.slippage')}>
            <input type="number" min={0.1} max={5} step={0.1} value={settings.slippagePct} onChange={(e) => onChange('slippagePct', clamp(Number(e.target.value) || 1, 0.1, 5))} className="field !py-1.5 text-xs" />
          </Field>
          <Field label={t('hl.settings.marginMode')}>
            <select value={settings.isCross ? 'cross' : 'isolated'} onChange={(e) => onChange('isCross', e.target.value === 'cross')} className="field !py-1.5 text-xs">
              <option value="cross">{t('hl.settings.cross')}</option>
              <option value="isolated">{t('hl.settings.isolated')}</option>
            </select>
          </Field>
        </div>
        <Field label={t('hl.settings.takeProfit')} hint={t('hl.settings.takeProfitHint')}>
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 text-xs">
            {(['profitPct', 'tp1', 'tpFinal'] as HlTakeProfitMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => onChange('takeProfit', mode)} className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${settings.takeProfit === mode ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {t(`hl.settings.${mode}`)}
              </button>
            ))}
          </div>
        </Field>
        {settings.takeProfit === 'profitPct' && (
          <Field label={t('hl.settings.targetPct')} hint={t('hl.settings.targetPctHint')}>
            <input type="number" min={0.1} max={100} step={0.1} value={settings.targetPct} onChange={(e) => onChange('targetPct', clamp(Number(e.target.value) || 2, 0.1, 100))} className="field !py-1.5 text-xs" />
          </Field>
        )}
      </div>
    </Card>
  );
};

export default SettingsCard;
