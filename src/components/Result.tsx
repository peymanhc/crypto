import React from 'react';
import { TradingResult } from '../types/trading';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ResultProps {
  result: TradingResult;
}

const Result: React.FC<ResultProps> = ({ result }) => {
  const getSignalColor = (signal?: string) => {
    if (!signal) return 'text-gray-600';
    if (signal.includes('Long') || signal.includes("Uptrend") || signal.includes("Bullish")) return 'text-green-600';
    if (signal.includes('Short') || signal.includes("Downtrend") || signal.includes("Bearish")) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSignalIcon = (signal?: string) => {
    if (!signal) return null;
    if (signal.includes('Long') || signal.includes("Bullish")) return <TrendingUp className="w-4 h-4" />;
    if (signal.includes('Short') || signal.includes("Bearish")) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  const formatValue = (value?: number | null) =>
    value === null || value === undefined ? '—' : Number(value.toPrecision(8)).toString();

  return (
    <div className="bg-white p-4 rounded-lg space-y-3 h-full flex-1 min-h-0">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-0.5">
          <p className="text-gray-600 text-xs">Current Price</p>
          <p className="text-base font-bold">{result.currentPrice}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-green-700 font-bold text-xs">Support:</p>
          <p className="text-base font-bold text-green-700">{result.support}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-red-600 font-bold text-xs">Resistance:</p>
          <p className="text-base font-bold text-red-600">{result.resistance}</p>
        </div>
      </div>
      <div className="pt-2 border-t space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-gray-600 text-sm">Short term:</p>
          <div className={`flex items-center gap-1.5 ${getSignalColor(result.signal)}`}>
            {getSignalIcon(result.signal)}
            <p className="text-sm font-bold">{result.signal}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-600 text-sm">Trend:</p>
          <div className={`flex items-center gap-1.5 ${getSignalColor(result.trend)}`}>
            <p className="text-sm font-bold">{result.trend}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-600 text-sm">PriceActionSignal:</p>
          <div className={`flex items-center gap-1.5 ${getSignalColor(result.priceActionSignal)}`}>
            {getSignalIcon(result.priceActionSignal)}
            <p className="text-sm font-bold">{result.priceActionSignal}</p>
          </div>
        </div>
      </div>
      <div className="pt-2 border-t">
        <p className="text-gray-600 font-bold text-sm mb-1">Ichimoku</p>
        <div className="gap-x-4 gap-y-0.5 grid grid-cols-1 md:grid-cols-2 text-sm">
          <div className='flex items-center gap-2 w-full justify-between'><h4>tenkanSen:</h4><p>{formatValue(result.ichimokuValues?.tenkanSen)}</p></div>
          <div className='flex items-center gap-2 w-full justify-between'><h4>kijunSen:</h4><p>{formatValue(result.ichimokuValues?.kijunSen)}</p></div>
          <div className='flex items-center gap-2 w-full justify-between'><h4>senkouSpanA:</h4><p>{formatValue(result.ichimokuValues?.senkouSpanA)}</p></div>
          <div className='flex items-center gap-2 w-full justify-between'><h4>senkouSpanB:</h4><p>{formatValue(result.ichimokuValues?.senkouSpanB)}</p></div>
          <div className='flex items-center gap-2 w-full justify-between'><h4>chikouSpan:</h4><p>{formatValue(result.ichimokuValues?.chikouSpan)}</p></div>
        </div>
      </div>
    </div>
  );
};

export default Result;
