import React, { useState } from 'react';
import { TRADING_PAIRS, TIMEFRAMES } from '../constants/trading';
import { TradingFormData } from '../types/trading';

interface TradingFormProps {
  onSubmit: (data: TradingFormData) => void;
  isLoading: boolean;
}

const TradingForm: React.FC<TradingFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<TradingFormData>({
    symbol: TRADING_PAIRS[0],
    timeframe: TIMEFRAMES[0].value
  });
  const [selectCoinMethod, setSelectCoinMethod] = useState(true); // Default to select box

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChangeMethod = (value:boolean)=>{
    setSelectCoinMethod(value)
    setFormData({...formData,symbol:value? TRADING_PAIRS[0] :""})
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-lg font-medium">Choose Coin Method</label>
        <div>
          <label>
            <input
              type="radio"
              value="select"
              className='mr-2'
              checked={selectCoinMethod}
              onChange={() => handleChangeMethod(true)}
              disabled={isLoading}
            />
            Use WatchList Coins
          </label>
          <label className="ml-4">
            <input
              type="radio"
              className='mr-2'
              value="input"
              checked={!selectCoinMethod}
              onChange={() => handleChangeMethod(false)}
              disabled={isLoading}
            />
            Write Coin Name
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="symbol" className="block text-lg font-medium">
          Choose Coin
        </label>
        {selectCoinMethod ? (
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
        ) : (
          <input
            type="text"
            id="symbol"
            value={formData.symbol}
            onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toLocaleUpperCase() }))}
            className="w-full p-2 border rounded-lg bg-white"
            placeholder="Enter coin name"
            disabled={isLoading}
          />
        )}
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