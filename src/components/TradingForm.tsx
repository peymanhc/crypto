import React, { useEffect, useRef, useState } from 'react';
import { TRADING_PAIRS, TIMEFRAMES } from '../constants/trading';
import { TradingFormData } from '../types/trading';
import { fetchTradingPairs } from '../services/api';
import { Search, Clock, ArrowRight, Loader2 } from 'lucide-react';
import Card from './ui/Card';
import { useI18n } from '../i18n';

interface TradingFormProps {
  onSubmit: (data: TradingFormData) => void;
  isLoading: boolean;
}

const MAX_SUGGESTIONS = 50;

const TradingForm: React.FC<TradingFormProps> = ({ onSubmit, isLoading }) => {
  const { t, ttf } = useI18n();
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
    <Card title={t('form.title')} icon={<Search className="h-4 w-4" />} className="z-20" right={
      <span className="text-[11px] text-slate-500">{t('form.pairs', { count: pairs.length.toLocaleString() })}</span>
    }>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="relative">
          <label htmlFor="symbol" className="label">{t('form.coin')}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
              className="field ps-9 font-mono"
              placeholder={t('form.coinPlaceholder')}
              disabled={isLoading}
            />
          </div>
          {isOpen && suggestions.length > 0 && (
            <ul
              ref={listRef}
              className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-ink-800/95 p-1 text-sm shadow-2xl backdrop-blur-xl"
            >
              {suggestions.map((pair, index) => (
                <li
                  key={pair}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPair(pair)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 font-mono transition-colors ${
                    index === highlighted ? 'bg-glow-cyan/15 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {pair}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="timeframe" className="label">{t('form.timeframe')}</label>
          <div className="relative">
            <Clock className="pointer-events-none absolute start-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select
              id="timeframe"
              value={formData.timeframe}
              onChange={(e) => setFormData(prev => ({ ...prev, timeframe: e.target.value }))}
              className="field ps-9"
              disabled={isLoading}
            >
              {TIMEFRAMES.map(({ value }) => (
                <option key={value} value={value}>{ttf(value)}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full !py-2.5">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t('form.loading')}
            </>
          ) : (
            <>
              {t('form.submit')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </>
          )}
        </button>
      </form>
    </Card>
  );
};

export default TradingForm;
