import { AnimatePresence } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { useBacktestConfig } from '../hooks/useBacktestConfig';
import { useBacktestRunner } from '../hooks/useBacktestRunner';
import { useI18n } from '../i18n';
import PageTitle from '../components/ui/PageTitle';
import SetupCard from '../components/backtest/SetupCard';
import TopCoinsCard from '../components/backtest/TopCoinsCard';
import HowItWorksCard from '../components/backtest/HowItWorksCard';
import ProgressCard from '../components/backtest/ProgressCard';
import EmptyState from '../components/backtest/EmptyState';
import ResultsView from '../components/backtest/ResultsView';

// Backtest page: the form on the left, and on the right either the progress,
// the empty state, or the results. Read-only: nothing here posts to Telegram.
function BacktestPage() {
  const { t } = useI18n();
  const { config, update, apply } = useBacktestConfig();
  const { run, running, progress, result, error } = useBacktestRunner();

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><FlaskConical className="h-3.5 w-3.5" /> {t('bt.eyebrow')}</>}
        eyebrowColor="text-glow-violet"
        title={<>{t('bt.title.a')} <span className="gradient-text">{t('bt.title.b')}</span></>}
        description={t('bt.description')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4 xl:col-span-3">
          <SetupCard config={config} running={running} error={error} onChange={update} onRun={() => run(config)} />
          <TopCoinsCard config={config} disabled={running} onApply={apply} />
          <HowItWorksCard />
        </div>

        <div className="lg:col-span-8 xl:col-span-9">
          <AnimatePresence mode="wait">
            {running && progress && <ProgressCard key="progress" progress={progress} />}
            {!running && !result && <EmptyState key="empty" />}
            {!running && result && <ResultsView key="result" result={result} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default BacktestPage;
