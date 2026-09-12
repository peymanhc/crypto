import { useState } from 'react';
import { TradingResult, TradingFormData, TimeframeAdvice, CmeGap } from './types/trading';
import TradingForm from './components/TradingForm';
import Result from './components/Result';
import MultiTimeframeAdvice from './components/MultiTimeframeAdvice';
import SignalCard from './components/SignalCard';
import AutopilotPanel from './components/AutopilotPanel';
import { fetchTradingStrategy, fetchMultiTimeframeAdvice } from './services/api';
import { AlertCircle, LineChart } from 'lucide-react';

function App() {
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
      setError('خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.');
      console.error('Error fetching trading strategy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const placeholder = (text: string) => (
    <div className="bg-white rounded-lg flex-1 h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-gray-400 text-sm p-4">
      <LineChart className="w-6 h-6" />
      {text}
    </div>
  );

  return (
    <div className="min-h-[100svh] bg-gray-100 flex flex-col p-3 gap-2">
      <h1 className="text-lg lg:text-xl font-bold text-gray-900 text-center shrink-0">
        Coin Analysis
      </h1>

      {/* The page itself scrolls; nothing is clipped inside fixed-height columns */}
      <div className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-3 flex flex-col gap-3 relative z-20">
          {/* Natural height: with the autopilot panel below, a flex-1/min-h-0 form would be
              squeezed under its own content and overlap the panel */}
          <div className="shrink-0">
            <TradingForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          <AutopilotPanel />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 shrink-0">
              <AlertCircle className="text-red-500 w-4 h-4 shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col">
          {result && !error
            ? <Result result={result} />
            : placeholder('Submit a request to see the analysis')}
        </div>

        <div className="lg:col-span-5 flex flex-col">
          {result?.plan && submitted && !error
            ? <SignalCard
                key={submittedAt}
                symbol={submitted.symbol}
                timeframe={submitted.timeframe}
                plan={result.plan}
                submittedAt={submittedAt}
              />
            : placeholder('The trade signal for the selected timeframe will appear here')}
        </div>

        <div className="lg:col-span-12">
          {advices && !error
            ? <MultiTimeframeAdvice advices={advices} cmeGaps={cmeGaps} symbol={submitted?.symbol ?? ''} />
            : placeholder('Long / Short advice per timeframe will appear here')}
        </div>
      </div>

      <div className="shrink-0 text-center text-xs text-gray-600">
        Contact Us to Add Your Desired Coin — <span className="font-bold">Peymanhc@gmail.com</span>
      </div>
    </div>
  );
}

export default App;
