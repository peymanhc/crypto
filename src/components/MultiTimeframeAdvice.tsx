import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TimeframeAdvice, CmeGap } from '../types/trading';
import { ArrowUpRight, ArrowDownRight, Layers3, History } from 'lucide-react';
import GapFillSignalModal from './GapFillSignalModal';
import Card from './ui/Card';
import { DirectionBadge } from './ui/Badge';
import { useI18n } from '../i18n';

interface MultiTimeframeAdviceProps {
  advices: TimeframeAdvice[];
  cmeGaps: CmeGap[];
  symbol: string;
}

const formatPrice = (value: number): string =>
  value >= 1000 ? value.toFixed(2) : Number(value.toPrecision(5)).toString();

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

interface GapChipProps {
  gap: CmeGap;
  onSelect?: (gap: CmeGap) => void;
}

// Open (unfilled) gaps are clickable and open the gap-fill signal builder
const GapChip: React.FC<GapChipProps> = ({ gap, onSelect }) => {
  const { t } = useI18n();
  const clickable = !gap.filled && onSelect;
  const content = (
    <>
      {gap.sizePct > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {formatDate(gap.openedAt)}: {formatPrice(gap.from)} → {formatPrice(gap.to)} (
      {gap.sizePct > 0 ? '+' : ''}{gap.sizePct.toFixed(2)}%) · {gap.filled ? t('advice.filled') : t('advice.open')}
    </>
  );
  const className = `inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] leading-4 transition-all
    ${gap.filled
      ? 'border-white/[0.06] bg-white/[0.02] text-slate-500'
      : gap.sizePct > 0
        ? 'border-long/30 bg-long/10 text-long'
        : 'border-short/30 bg-short/10 text-short'}`;

  return clickable ? (
    <button
      type="button"
      onClick={() => onSelect(gap)}
      title={t('advice.gapTitle')}
      className={`${className} cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(34,211,238,0.5)] hover:ring-1 hover:ring-glow-cyan/50`}
    >
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );
};

// Per-timeframe cards only show the most recent few gaps; the full list sits below
const MAX_INLINE_GAPS = 4;

const accentFor = (recommendation: TimeframeAdvice['recommendation']) =>
  recommendation === 'Long' ? 'from-long/40' : recommendation === 'Short' ? 'from-short/40' : 'from-white/10';

const MultiTimeframeAdvice: React.FC<MultiTimeframeAdviceProps> = ({ advices, cmeGaps, symbol }) => {
  const { t, ttf } = useI18n();
  const openGaps = cmeGaps.filter((gap) => !gap.filled);
  const [selectedGap, setSelectedGap] = useState<CmeGap | null>(null);

  const longs = advices.filter((a) => a.recommendation === 'Long').length;
  const shorts = advices.filter((a) => a.recommendation === 'Short').length;

  return (
    <Card
      title={t('advice.title')}
      icon={<Layers3 className="h-4 w-4" />}
      hover={false}
      delay={0.15}
      right={
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="chip border-long/30 bg-long/10 text-long">{t('advice.longCount', { count: longs })}</span>
          <span className="chip border-short/30 bg-short/10 text-short">{t('advice.shortCount', { count: shorts })}</span>
          <span className="chip border-white/10 bg-white/[0.05] text-slate-300">{t('advice.neutralCount', { count: advices.length - longs - shorts })}</span>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {advices.map((advice, index) => (
          <motion.div
            key={advice.timeframe}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="glass glass-hover relative overflow-hidden p-3.5"
          >
            <span className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentFor(advice.recommendation)} via-transparent to-transparent`} />
            <div className="relative flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-white">{ttf(advice.timeframe)}</p>
              <DirectionBadge direction={advice.recommendation} />
            </div>
            {/* The reason is written by the analysis engine and stays in English */}
            <p dir="ltr" className="relative mt-2 whitespace-pre-line text-start text-xs leading-relaxed text-slate-400">{advice.reason}</p>
            <div className="relative mt-2.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('advice.gaps')}</span>
              {advice.gaps && advice.gaps.length > 0 ? (
                <>
                  {advice.gaps.slice(0, MAX_INLINE_GAPS).map((gap) => (
                    <GapChip key={gap.openedAt} gap={gap} onSelect={setSelectedGap} />
                  ))}
                  {advice.gaps.length > MAX_INLINE_GAPS && (
                    <span className="text-[10px] text-slate-500">{t('advice.more', { count: advice.gaps.length - MAX_INLINE_GAPS })}</span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-slate-500">{t('common.none')}</span>
              )}
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + advices.length * 0.06, duration: 0.45 }}
          className="glass p-3.5 md:col-span-2 xl:col-span-3"
        >
          <div className="relative flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-white">
              <History className="h-4 w-4 text-glow-cyan" /> {t('advice.history')} <span className="text-slate-500">· {t('advice.months')}</span>
            </p>
            <span className="text-[11px] text-slate-500">{t('advice.openTotal', { open: openGaps.length, total: cmeGaps.length })}</span>
          </div>
          {cmeGaps.length > 0 ? (
            <div className="relative mt-2.5 flex flex-wrap gap-1.5">
              {cmeGaps.map((gap) => (
                <GapChip key={gap.openedAt} gap={gap} onSelect={setSelectedGap} />
              ))}
            </div>
          ) : (
            <p className="relative mt-2 text-[11px] text-slate-500">{t('advice.noGaps')}</p>
          )}
        </motion.div>
      </div>

      {selectedGap && symbol && (
        <GapFillSignalModal symbol={symbol} gap={selectedGap} onClose={() => setSelectedGap(null)} />
      )}
    </Card>
  );
};

export default MultiTimeframeAdvice;
