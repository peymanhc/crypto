import React, { useState } from 'react';
import { TimeframeAdvice, Recommendation, CmeGap } from '../types/trading';
import { TrendingUp, TrendingDown, MinusCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import GapFillSignalModal from './GapFillSignalModal';

interface MultiTimeframeAdviceProps {
  advices: TimeframeAdvice[];
  cmeGaps: CmeGap[];
  symbol: string;
}

const badgeStyles: Record<Recommendation, string> = {
  Long: 'bg-green-100 text-green-700',
  Short: 'bg-red-100 text-red-700',
  Neutral: 'bg-gray-100 text-gray-600',
};

const badgeLabels: Record<Recommendation, string> = {
  Long: 'LONG',
  Short: 'SHORT',
  Neutral: 'NEUTRAL',
};

const badgeIcons: Record<Recommendation, React.ReactNode> = {
  Long: <TrendingUp className="w-3.5 h-3.5" />,
  Short: <TrendingDown className="w-3.5 h-3.5" />,
  Neutral: <MinusCircle className="w-3.5 h-3.5" />,
};

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
  const clickable = !gap.filled && onSelect;
  const content = (
    <>
      {gap.sizePct > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {formatDate(gap.openedAt)}: {formatPrice(gap.from)} → {formatPrice(gap.to)} (
      {gap.sizePct > 0 ? '+' : ''}{gap.sizePct.toFixed(2)}%) {gap.filled ? '· filled' : '· OPEN'}
    </>
  );
  const className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] leading-4
    ${gap.filled
      ? 'border-gray-200 bg-gray-50 text-gray-400'
      : gap.sizePct > 0
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-red-200 bg-red-50 text-red-700'}`;

  return clickable ? (
    <button
      type="button"
      onClick={() => onSelect(gap)}
      title="Build a gap-fill signal"
      className={`${className} cursor-pointer hover:ring-1 hover:ring-blue-300 hover:shadow-sm`}
    >
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );
};

// Per-timeframe cards only show the most recent few gaps; the full list sits below
const MAX_INLINE_GAPS = 4;

const MultiTimeframeAdvice: React.FC<MultiTimeframeAdviceProps> = ({ advices, cmeGaps, symbol }) => {
  const openGaps = cmeGaps.filter((gap) => !gap.filled);
  const [selectedGap, setSelectedGap] = useState<CmeGap | null>(null);

  return (
    <div className="bg-white p-4 rounded-lg flex flex-col gap-2">
      <h2 className="text-base font-bold text-gray-900 shrink-0">Long / Short by Timeframe</h2>
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 flex-1 min-h-0 content-start">
        {advices.map((advice) => (
          <div key={advice.timeframe} className="border rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-gray-800">{advice.label}</p>
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${badgeStyles[advice.recommendation]}`}
              >
                {badgeIcons[advice.recommendation]}
                {badgeLabels[advice.recommendation]}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1.5 leading-snug whitespace-pre-line">{advice.reason}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-medium text-gray-500">CME gaps in this window:</span>
              {advice.gaps && advice.gaps.length > 0 ? (
                <>
                  {advice.gaps.slice(0, MAX_INLINE_GAPS).map((gap) => (
                    <GapChip key={gap.openedAt} gap={gap} onSelect={setSelectedGap} />
                  ))}
                  {advice.gaps.length > MAX_INLINE_GAPS && (
                    <span className="text-[10px] text-gray-400">
                      +{advice.gaps.length - MAX_INLINE_GAPS} more (see history below)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-gray-400">none</span>
              )}
            </div>
          </div>
        ))}

        <div className="border rounded-lg p-2.5 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-gray-800">CME Gap History (~7 months)</p>
            <span className="text-[10px] text-gray-500">
              {openGaps.length} open / {cmeGaps.length} total
            </span>
          </div>
          {cmeGaps.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {cmeGaps.map((gap) => (
                <GapChip key={gap.openedAt} gap={gap} onSelect={setSelectedGap} />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 mt-1.5">
              No weekend gaps above 0.05% detected for this pair.
            </p>
          )}
        </div>
      </div>

      {selectedGap && symbol && (
        <GapFillSignalModal symbol={symbol} gap={selectedGap} onClose={() => setSelectedGap(null)} />
      )}
    </div>
  );
};

export default MultiTimeframeAdvice;
