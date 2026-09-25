import { FlaskConical } from 'lucide-react';
import { EngineInputs } from '../../lib/strategies/engine';
import { useSignalLab } from '../../hooks/useSignalLab';
import { useI18n } from '../../i18n';
import TradingForm from '../TradingForm';
import Card from '../ui/Card';
import Placeholder from '../ui/Placeholder';
import { DirectionBadge } from '../ui/Badge';
import VoteList from './VoteList';
import LabSignalCard from './LabSignalCard';

// Coin + timeframe form on the left, votes and the signal on the right.
// Analyses with the ACTIVE engine (dashboard rules / selected presets / my strategy).
const SignalLab: React.FC<{ inputs: EngineInputs }> = ({ inputs }) => {
  const { t } = useI18n();
  const { run, loading, error, result, submitted } = useSignalLab(inputs);
  const engineLabel = t(`engine.${inputs.engine}`);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
          <FlaskConical className="h-4 w-4 text-glow-cyan" /> {t('lab.title')}
        </h2>
        <p className="text-xs text-slate-500">{t('lab.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <TradingForm onSubmit={run} isLoading={loading} />
          {error && <p className="rounded-xl border border-short/30 bg-short/10 p-3 text-sm text-short">{error}</p>}
        </div>

        <div className="lg:col-span-4">
          {result && submitted ? (
            <Card title={t('lab.votes')} icon={<FlaskConical className="h-4 w-4" />} hover={false} right={<DirectionBadge direction={result.direction} />} className="h-full">
              <VoteList reasons={result.reasons} caution={result.caution} />
            </Card>
          ) : (
            <Placeholder text={t('dash.placeholder.analysis')} loading={loading} />
          )}
        </div>

        <div className="lg:col-span-5">
          {result && submitted ? (
            <LabSignalCard key={submitted.at} symbol={submitted.symbol} timeframe={submitted.timeframe} plan={result.plan} engineLabel={engineLabel} />
          ) : (
            <Placeholder text={t('dash.placeholder.signal')} loading={loading} delay={0.05} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SignalLab;
