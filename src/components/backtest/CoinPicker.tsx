import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { fetchTradingPairs } from '../../services/api';
import Field from '../ui/Field';
import { useI18n } from '../../i18n';

interface CoinPickerProps {
  symbols: string[];
  max: number;
  disabled?: boolean;
  onChange: (symbols: string[]) => void;
}

// "BTCUSDT" -> "BTC/USDT"; "BTC/USDT" stays as is
const toPair = (raw: string): string => {
  const value = raw.trim().toUpperCase();
  return value.includes('/') ? value : value.replace(/^(.+?)(USDT|USDC|FDUSD|TUSD|BUSD)$/, '$1/$2');
};

const looksLikePair = (pair: string) => /^[A-Z0-9]{2,15}\/[A-Z0-9]{2,10}$/.test(pair);

// Chips for the chosen coins plus a search box (with Binance pair suggestions) to add more
const CoinPicker: React.FC<CoinPickerProps> = ({ symbols, max, disabled, onChange }) => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [allPairs, setAllPairs] = useState<string[]>([]);

  useEffect(() => {
    fetchTradingPairs().then(setAllPairs).catch(() => {});
  }, []);

  const query = input.trim().toUpperCase();
  const suggestions = query ? allPairs.filter((p) => p.startsWith(query) && !symbols.includes(p)).slice(0, 20) : [];

  const add = (raw: string) => {
    const pair = toPair(raw);
    if (!looksLikePair(pair) || symbols.includes(pair) || symbols.length >= max) return;
    onChange([...symbols, pair]);
    setInput('');
  };

  const remove = (pair: string) => onChange(symbols.filter((s) => s !== pair));

  return (
    <Field label={t('bt.coins', { count: symbols.length, max })}>
      <AnimatePresence>
        {symbols.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {symbols.map((pair) => (
              <motion.span
                layout
                key={pair}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="inline-flex items-center gap-1 rounded-lg border border-glow-violet/30 bg-glow-violet/10 px-2 py-0.5 font-mono text-[11px] text-glow-violet"
              >
                {pair}
                <button type="button" onClick={() => remove(pair)} className="text-glow-violet/60 hover:text-white" aria-label={`Remove ${pair}`}>
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>

      {symbols.length < max && (
        <div className="relative">
          <Plus className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            list="backtest-pairs"
            value={input}
            disabled={disabled}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              add(suggestions[0] ?? input);
            }}
            placeholder={t('bt.addCoin')}
            className="field !py-1.5 ps-8 font-mono text-xs"
          />
          <datalist id="backtest-pairs">
            {suggestions.map((pair) => <option key={pair} value={pair} />)}
          </datalist>
        </div>
      )}
    </Field>
  );
};

export default CoinPicker;
