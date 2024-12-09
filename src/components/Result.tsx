import React from 'react';
import { TradingResult } from '../types/trading';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ResultProps {
  result: TradingResult;
}

const Result: React.FC<ResultProps> = ({ result }) => {
  const getSignalColor = (signal: string) => {
    if (signal.includes('Long') || signal.includes("Uptrend") || signal.includes("Bullish")) return 'text-green-600';
    if (signal.includes('Short') || signal.includes("Downtrend") || signal.includes("Bearish")) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSignalIcon = (signal: string) => {
    if (signal.includes('Long') || signal.includes("Bullish")) return <TrendingUp className="w-6 h-6" />;
    if (signal.includes('Short') || signal.includes("Bearish")) return <TrendingDown className="w-6 h-6" />;
    return null;
  };
  return (
    <div className="bg-white p-6 rounded-lg  space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="space-y-1 col-span-4 ">
          <p className="text-gray-600">Current Price</p>
          <p className="text-xl font-bold">{result.currentPrice}</p>
        </div>
        <div className="space-y-1 col-span-4">
          <p className="text-green-700 font-bold text-[12px]">Support:</p>
          <p className="text-xl font-bold text-green-700">{result.support}</p>
        </div>
        <div className="space-y-1 col-span-4">
          <p className="text-red-600 font-bold text-[12px]">Resistance:</p>
          <p className="text-xl font-bold text-red-600">{result.resistance}</p>
        </div>
        {/* {result.signal !== "Sideways Trend" && <>
        <div className="space-y-1 col-span-4">
          <p className="text-red-900"></p>
          <p className="text-xl font-bold text-red-600">{result.smaShort}</p>
        </div>
        <div className="space-y-1 col-span-4">
          <p className="text-green-900">Long Position</p>
          <p className="text-xl font-bold text-green-600">{result.smaLong}</p>
        </div></>} */}
      </div>
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Short term:</p>
          <div className={`flex items-center gap-2 ${getSignalColor(result.signal)}`}>
            {getSignalIcon(result.signal)}
            <p className="text-lg font-bold">{result.signal}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Trend:</p>
          <div className={`flex items-center gap-2 ${getSignalColor(result.trend)}`}>
          
            <p className="text-lg font-bold">{result.trend}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">PriceActionSignal:</p>
          <div className={`flex items-center gap-2 ${getSignalColor(result.priceActionSignal)}`}>
          {getSignalIcon(result.priceActionSignal)}
            <p className="text-lg font-bold">{result.priceActionSignal}</p>
          </div>
        </div>
        <div className="border-t pt-4 flex items-center justify-between mt-[16px]">
          <p className="text-gray-600 font-bold text-[18px]">Ichimoku</p>
        </div>
        <div className={`gap-2 grid grid-cols-1 md:grid-cols-2`}>
         <div className='flex items-center gap-2 w-full justify-between ' > <h4>tenkanSen:</h4><p>{result.ichimokuValues?.tenkanSen}</p></div>
         <div className='flex items-center gap-2 w-full justify-between ' > <h4>kijunSen:</h4><p>{result.ichimokuValues?.kijunSen}</p></div>
         <div className='flex items-center gap-2 w-full justify-between ' > <h4>senkouSpanA:</h4><p>{result.ichimokuValues?.senkouSpanA}</p></div>
         <div className='flex items-center gap-2 w-full justify-between ' > <h4>senkouSpanB:</h4><p>{result.ichimokuValues?.senkouSpanB}</p></div>
         <div className='flex items-center gap-2 w-full justify-between ' > <h4>chikouSpan:</h4><p>{result.ichimokuValues?.chikouSpan}</p></div>
          </div>
      </div>
    </div>
  );
};

export default Result;