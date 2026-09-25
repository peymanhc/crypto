import React from 'react';
import { motion } from 'framer-motion';
import { TradingResult } from '../types/trading';
import { TrendingUp, TrendingDown, Activity, Layers } from 'lucide-react';
import Card from './ui/Card';
import AnimatedNumber from './ui/AnimatedNumber';
import { useI18n } from '../i18n';

interface ResultProps {
  result: TradingResult;
}

const Result: React.FC<ResultProps> = ({ result }) => {
  const { t, tv } = useI18n();
  const getSignalColor = (signal?: string) => {
    if (!signal) return 'text-slate-400';
    if (signal.includes('Long') || signal.includes("Uptrend") || signal.includes("Bullish")) return 'text-long';
    if (signal.includes('Short') || signal.includes("Downtrend") || signal.includes("Bearish")) return 'text-short';
    return 'text-slate-300';
  };

  const getSignalIcon = (signal?: string) => {
    if (!signal) return null;
    if (signal.includes('Long') || signal.includes("Bullish")) return <TrendingUp className="w-4 h-4" />;
    if (signal.includes('Short') || signal.includes("Bearish")) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  const formatValue = (value?: number | null) =>
    value === null || value === undefined ? '—' : Number(value.toPrecision(8)).toString();

  const rows: { label: string; value?: string }[] = [
    { label: t('result.shortTerm'), value: result.signal },
    { label: t('result.trend'), value: result.trend },
    { label: t('result.priceAction'), value: result.priceActionSignal },
  ];

  const ichimoku: { label: string; value?: number | null }[] = [
    { label: t('result.tenkan'), value: result.ichimokuValues?.tenkanSen },
    { label: t('result.kijun'), value: result.ichimokuValues?.kijunSen },
    { label: t('result.senkouA'), value: result.ichimokuValues?.senkouSpanA },
    { label: t('result.senkouB'), value: result.ichimokuValues?.senkouSpanB },
    { label: t('result.chikou'), value: result.ichimokuValues?.chikouSpan },
  ];

  // Where the price sits between the 20-candle low and high
  const rangeSpan = result.resistance - result.support;
  const position = rangeSpan > 0 ? Math.min(100, Math.max(0, ((result.currentPrice - result.support) / rangeSpan) * 100)) : 50;

  return (
    <Card title={t('result.title')} icon={<Activity className="h-4 w-4" />} className="h-full" delay={0.05}>
      <div className="space-y-4">
        <div>
          <p className="label">{t('result.currentPrice')}</p>
          <p className="font-display text-3xl font-semibold tracking-tight text-white">
            <AnimatedNumber value={result.currentPrice} format={(n) => Number(n.toPrecision(8)).toString()} />
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-long">{t('result.support')} <span className="num">{result.support}</span></span>
            <span className="font-semibold text-short"><span className="num">{result.resistance}</span> {t('result.resistance')}</span>
          </div>
          <div dir="ltr" className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-long/50 via-white/10 to-short/50">
            <motion.span
              initial={{ left: '50%' }}
              animate={{ left: `${position}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.15),0_0_16px_rgba(34,211,238,0.8)]"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">{t('result.rangeHint')}</p>
        </div>

        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2">
              <p className="text-sm text-slate-400">{row.label}</p>
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${getSignalColor(row.value)}`}>
                {getSignalIcon(row.value)}
                {row.value ? tv(row.value) : '—'}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="label flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {t('result.ichimoku')}</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ichimoku.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[12px]"
              >
                <span className="text-slate-400">{item.label}</span>
                <span className="num text-slate-100">{formatValue(item.value)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default Result;
