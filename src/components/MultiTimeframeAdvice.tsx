import React from 'react';
import { TimeframeAdvice, Recommendation } from '../types/trading';
import { TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';

interface MultiTimeframeAdviceProps {
  advices: TimeframeAdvice[];
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

const MultiTimeframeAdvice: React.FC<MultiTimeframeAdviceProps> = ({ advices }) => {
  return (
    <div className="bg-white p-4 rounded-lg h-full flex flex-col gap-2">
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
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 shrink-0">
        Signals are indicator-based (SMA 10/50, Ichimoku, engulfing patterns) and are not financial advice.
      </p>
    </div>
  );
};

export default MultiTimeframeAdvice;
