import React, { useEffect, useRef, useState } from 'react';
import { TRADING_PAIRS, TIMEFRAMES } from '../constants/trading';
import { TradingFormData } from '../types/trading';
import { fetchTradingPairs } from '../services/api';

interface TradingFormProps {
  onSubmit: (data: TradingFormData) => void;
  isLoading: boolean;
}

const MAX_SUGGESTIONS = 50;

const TradingForm: React.FC<TradingFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<TradingFormData>({
    symbol: TRADING_PAIRS[0],
    timeframe: TIMEFRAMES[0].value
  });
  const [pairs, setPairs] = useState<string[]>(TRADING_PAIRS);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTradingPairs()
      .then((allPairs) => {
        if (!cancelled && allPairs.length) setPairs(allPairs);
      })
      .catch(() => {
        // keep the static watchlist as fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const query = formData.symbol.trim().toUpperCase();
  const suggestions = (() => {
    if (!query) return pairs.slice(0, MAX_SUGGESTIONS);
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const pair of pairs) {
      if (pair.startsWith(query)) startsWith.push(pair);
      else if (pair.includes(query)) includes.push(pair);
      if (startsWith.length >= MAX_SUGGESTIONS) break;
    }
    return [...startsWith, ...includes].slice(0, MAX_SUGGESTIONS);
  })();

  const selectPair = (pair: string) => {
    setFormData((prev) => ({ ...prev, symbol: pair }));
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol.trim()) return;
    setIsOpen(false);
    onSubmit(formData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectPair(suggestions[Math.min(highlighted, suggestions.length - 1)]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 space-y-3 h-full min-h-0 flex flex-col">
      <div className="space-y-1 relative">
        <label htmlFor="symbol" className="block text-sm font-medium">
          Choose Coin <span className="text-xs text-gray-400 font-normal">({pairs.length} pairs)</span>
        </label>
        <input
          type="text"
          id="symbol"
          autoComplete="off"
          value={formData.symbol}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }));
            setIsOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full p-1.5 text-sm border rounded-lg bg-white"
          placeholder="Type to search, e.g. BTC/USDT"
          disabled={isLoading}
        />
        {isOpen && suggestions.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-10 w-full bg-white border rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg text-sm"
          >
            {suggestions.map((pair, index) => (
              <li
                key={pair}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPair(pair)}
                onMouseEnter={() => setHighlighted(index)}
                className={`px-3 py-1.5 cursor-pointer ${
                  index === highlighted ? 'bg-blue-100' : 'hover:bg-blue-50'
                }`}
              >
                {pair}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="timeframe" className="block text-sm font-medium">
          Choose TimeFrame
        </label>
        <select
          id="timeframe"
          value={formData.timeframe}
          onChange={(e) => setFormData(prev => ({ ...prev, timeframe: e.target.value }))}
          className="w-full p-1.5 text-sm border rounded-lg bg-white"
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
        className={`mt-auto w-full py-1.5 px-4 rounded-lg text-white text-sm font-medium transition-colors
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
