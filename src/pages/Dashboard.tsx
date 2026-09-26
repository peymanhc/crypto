import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Sparkles } from 'lucide-react';
import { TradingResult, TradingFormData, TimeframeAdvice, CmeGap } from '../types/trading';
import { fetchTradingStrategy, fetchMultiTimeframeAdvice } from '../services/api';
import TradingForm from '../components/TradingForm';
import Result from '../components/Result';
import MultiTimeframeAdvice from '../components/MultiTimeframeAdvice';
import SignalCard from '../components/SignalCard';
import AutopilotPanel from '../components/AutopilotPanel';
import NoTradeWindowsCard from '../components/NoTradeWindowsCard';
import PageTitle from '../components/ui/PageTitle';
import Placeholder from '../components/ui/Placeholder';
import { useI18n } from '../i18n';

// Home page: the analysis form, the live signal, and the multi-timeframe advice.
// The data flow is the original App.tsx; only the layout and styling changed.
function Dashboard() {
  const { t } = useI18n();
  const [result, setResult] = useState<TradingResult | null>(null);
  const [advices, setAdvices] = useState<TimeframeAdvice[] | null>(null);
  const [cmeGaps, setCmeGaps] = useState<CmeGap[]>([]);
  const [submitted, setSubmitted] = useState<TradingFormData | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: TradingFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const [data, adviceData] = await Promise.all([
        fetchTradingStrategy(formData),
        fetchMultiTimeframeAdvice(formData.symbol),
      ]);
      setResult(data);
      setAdvices(adviceData.advices);
      setCmeGaps(adviceData.cmeGaps);
      setSubmitted(formData);
      setSubmittedAt(Date.now());
    } catch (err) {
      setError(t('dash.error'));
      console.error('Error fetching trading strategy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const hasResult = result !== null && !error;

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><Sparkles className="h-3.5 w-3.5" /> {t('dash.eyebrow')}</>}
        title={<>{t('dash.title.a')} <span className="gradient-text">{t('dash.title.b')}</span></>}
        description={t('dash.description')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <TradingForm onSubmit={handleSubmit} isLoading={isLoading} />
          <AutopilotPanel />
          <NoTradeWindowsCard />
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-2xl border border-short/30 bg-short/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-short" />
              <p className="text-sm text-short">{error}</p>
            </motion.div>
          )}
        </div>

        <div className="flex flex-col lg:col-span-4">
          {hasResult ? <Result result={result} /> : <Placeholder text={t('dash.placeholder.analysis')} loading={isLoading} delay={0.05} />}
        </div>

        <div className="flex flex-col lg:col-span-5">
          {hasResult && result.plan && submitted ? (
            <SignalCard key={submittedAt} symbol={submitted.symbol} timeframe={submitted.timeframe} plan={result.plan} submittedAt={submittedAt} />
          ) : (
            <Placeholder text={t('dash.placeholder.signal')} loading={isLoading} delay={0.1} />
          )}
        </div>

        <div className="lg:col-span-12">
          {advices && !error ? (
            <MultiTimeframeAdvice advices={advices} cmeGaps={cmeGaps} symbol={submitted?.symbol ?? ''} />
          ) : (
            <Placeholder text={t('dash.placeholder.advice')} loading={isLoading} delay={0.15} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
