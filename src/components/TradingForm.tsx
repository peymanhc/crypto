import React from 'react';
import { TRADING_PAIRS, TIMEFRAMES } from '../constants/trading';
import { TradingFormData } from '../types/trading';

interface TradingFormProps {
  onSubmit: (data: TradingFormData) => void;
  isLoading: boolean;
}

const TradingForm: React.FC<TradingFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = React.useState<TradingFormData>({
    symbol: TRADING_PAIRS[0],
    timeframe: TIMEFRAMES[0].value
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="symbol" className="block text-lg font-medium">
        Choose Coin
        </label>
        <select
          id="symbol"
          value={formData.symbol}
          onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
          className="w-full p-2 border rounded-lg bg-white"
          disabled={isLoading}
        >
          {TRADING_PAIRS.map(pair => (
            <option key={pair} value={pair}>{pair}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="timeframe" className="block text-lg font-medium">
          Choose TimeFrame
        </label>
        <select
          id="timeframe"
          value={formData.timeframe}
          onChange={(e) => setFormData(prev => ({ ...prev, timeframe: e.target.value }))}
          className="w-full p-2 border rounded-lg bg-white"
          disabled={isLoading}
        >
          {TIMEFRAMES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-colors
          ${isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isLoading ? 'Loading ...' : 'Submit Request'}
      </button>
    </form>
  );
};

export default TradingForm;