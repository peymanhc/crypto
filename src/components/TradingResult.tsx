import React from 'react';
import { TradingResult } from '../types/trading';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradingResultProps {
  result: TradingResult;
}

const TradingResults: React.FC<TradingResultProps> = ({ result }) => {
  const getSignalColor = (signal: string) => {
    if (signal.includes('Long')) return 'text-green-600';
    if (signal.includes('Short')) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSignalIcon = (signal: string) => {
    if (signal.includes('Long')) return <TrendingUp className="w-6 h-6" />;
    if (signal.includes('Short')) return <TrendingDown className="w-6 h-6" />;
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <p className="text-gray-600">Current Price</p>
          <p className="text-xl font-bold">{result.currentPrice.toFixed(2)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-600">Short Position</p>
          <p className="text-xl font-bold">{result.smaShort.toFixed(2)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-600">Long Position</p>
          <p className="text-xl font-bold">{result.smaLong.toFixed(2)}</p>
        </div>
      </div>
      
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Signal:</p>
          <div className={`flex items-center gap-2 ${getSignalColor(result.signal)}`}>
            {getSignalIcon(result.signal)}
            <p className="text-lg font-bold">{result.signal}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingResults;