import { useState } from 'react';
import { Zap, ArrowUpRight, Loader2 } from 'lucide-react';
import { TradingFormData, TradePlan } from '../../types/trading';
import { HlOpenResult } from '../../types/hyperliquid';
import { analyzeCandles, buildTradePlan, formatSignalText } from '../../lib/analysis';
import { fetchBacktestCandles } from '../../lib/backtestData';
import { formatPrice } from '../../lib/format';
import { useI18n } from '../../i18n';
import TradingForm from '../TradingForm';
import Card from '../ui/Card';
import PlanLadder from '../signal/PlanLadder';
import { RiskBadge } from '../ui/Badge';
import { hlErrorText } from './errors';

interface ManualTradeCardProps {
  loggedIn: boolean;
  onOpen: (symbol: string, plan: TradePlan) => Promise<HlOpenResult>;
}

// Analyse one coin with the dashboard rules and open that exact signal on Hyperliquid
const ManualTradeCard: React.FC<ManualTradeCardProps> = ({ loggedIn, onOpen }) => {
  const { t, ttf } = useI18n();
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<{ form: TradingFormData; plan: TradePlan } | null>(null);
  const [opening, setOpening] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const analyze = async (form: TradingFormData) => {
    setLoading(true);
    setOutcome(null);
    try {
      const candles = await fetchBacktestCandles(form.symbol, form.timeframe, 200);
      setSignal({ form, plan: buildTradePlan(analyzeCandles(candles)) });
    } catch {
      setSignal(null);
      setOutcome({ ok: false, text: t('dash.error') });
    } finally {
      setLoading(false);
    }
  };

  const open = async () => {
    if (!signal) return;
    setOpening(true);
    setOutcome(null);
    try {
      const result = await onOpen(signal.form.symbol, signal.plan);
      setOutcome({ ok: true, text: t('hl.manual.opened', { coin: result.coin, size: result.size, price: formatPrice(result.avgPx), leverage: result.leverage }) });
    } catch (err) {
      setOutcome({ ok: false, text: hlErrorText(err instanceof Error ? err.message : String(err), t) });
    } finally {
      setOpening(false);
    }
  };

  const isTrade = signal !== null && signal.plan.direction !== 'Neutral';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <TradingForm onSubmit={analyze} isLoading={loading} />
      </div>
      <div className="lg:col-span-8">
        <Card
          title={t('signal.title')}
          icon={<Zap className="h-4 w-4" />}
          hover={false}
          className="h-full"
          right={signal && (
            <>
              {isTrade && <RiskBadge level={signal.plan.riskLevel} />}
              <span className="chip border-white/10 bg-white/[0.05] text-slate-300">{ttf(signal.form.timeframe)}</span>
            </>
          )}
        >
          {!signal ? (
            <p className="text-sm text-slate-500">{t('hl.manual.empty')}</p>
          ) : !isTrade ? (
            <p className="text-sm text-slate-400">{t('signal.noSignal', { timeframe: ttf(signal.form.timeframe) })}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <pre dir="ltr" className="whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-ink-900/70 p-3.5 text-start font-mono text-sm leading-6 text-slate-200 sm:col-span-3">{formatSignalText(signal.form.symbol, signal.plan)}</pre>
                <div className="sm:col-span-2">
                  <p className="label">{t('signal.ladder')}</p>
                  <PlanLadder plan={signal.plan} />
                </div>
              </div>
              <button type="button" onClick={open} disabled={!loggedIn || opening} className="btn-primary w-full !py-2.5">
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                {t('hl.manual.open')}
              </button>
              {!loggedIn && <p className="text-[11px] text-slate-500">{t('hl.manual.loginFirst')}</p>}
            </div>
          )}
          {outcome && (
            <p className={`mt-3 rounded-lg border px-2.5 py-2 text-[11px] ${outcome.ok ? 'border-long/30 bg-long/10 text-long' : 'border-short/30 bg-short/10 text-short'}`}>{outcome.text}</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ManualTradeCard;
