import { ListChecks } from 'lucide-react';
import { useI18n } from '../i18n';
import { useEngine } from '../hooks/useEngine';
import { useSimpleSelection } from '../hooks/useSimpleSelection';
import { useStrategies } from '../hooks/useStrategies';
import { PRESETS } from '../lib/strategies/presets';
import PageTitle from '../components/ui/PageTitle';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import EngineSelector from '../components/strategy/EngineSelector';
import PresetCard from '../components/strategy/PresetCard';
import SignalLab from '../components/lab/SignalLab';

// Simple mode: switch ready-made strategies on or off and let them vote together
function StrategiesPage() {
  const { t } = useI18n();
  const { engine, setEngine } = useEngine();
  const { selection, toggle, setMinAgree } = useSimpleSelection();
  const { active: proStrategy } = useStrategies();

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><ListChecks className="h-3.5 w-3.5" /> {t('simple.eyebrow')}</>}
        eyebrowColor="text-long"
        title={<>{t('simple.title.a')} <span className="gradient-text">{t('simple.title.b')}</span></>}
        description={t('simple.description')}
      />

      <EngineSelector
        engine={engine}
        onChange={setEngine}
        simpleStatus={t('simple.enabledCount', { count: selection.enabled.length })}
        proStatus={proStrategy ? proStrategy.name : t('builder.empty')}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((preset, index) => (
          <PresetCard key={preset.id} preset={preset} index={index} enabled={selection.enabled.includes(preset.id)} onToggle={() => toggle(preset.id)} />
        ))}
      </div>

      <Card hover={false}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <Field label={t('simple.minAgree')} hint={t('simple.minAgreeHint')}>
            <input type="number" min={1} max={Math.max(1, selection.enabled.length)} step={1} value={selection.minAgree} onChange={(e) => setMinAgree(Number(e.target.value) || 1)} className="field !w-24 !py-1.5 text-xs" />
          </Field>
          <span className="chip border-long/30 bg-long/10 text-long">{t('simple.enabledCount', { count: selection.enabled.length })}</span>
        </div>
      </Card>

      <SignalLab inputs={{ engine, simple: selection, pro: proStrategy }} />
    </div>
  );
}

export default StrategiesPage;
