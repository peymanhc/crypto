import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Loader2, Plus, Check, AlertTriangle } from 'lucide-react';
import { BacktestConfig } from '../../types/backtest';
import { TopCoin, UNIVERSE_SIZE } from '../../lib/backtest/topCoins';
import { useTopCoins } from '../../hooks/useTopCoins';
import { formatSignedPct } from '../../lib/format';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import { exitModeLabel } from './ExitRulePicker';

interface TopCoinsCardProps {
  config: BacktestConfig;
  disabled?: boolean;
  onApply: (next: Partial<BacktestConfig>) => void;
}

const MAX_COINS = 4;

// One ranked coin with its key numbers and an "Add" button
const CoinRow: React.FC<{ coin: TopCoin; added: boolean; canAdd: boolean; onAdd: () => void }> = ({ coin, added, canAdd, onAdd }) => {
  const { t } = useI18n();
  const { stats } = coin;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: coin.rank * 0.04 }}
      className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-4 shrink-0 text-center text-[10px] text-slate-500">{coin.rank}</span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-slate-200">{coin.symbol}</span>
          <span className="block text-[10px] text-slate-500">
            {t('bt.perCoin.win', { pct: stats.winRate.toFixed(0) })} · {t('bt.perCoin.trades', { count: stats.trades })}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`num font-semibold ${stats.totalReturnPct >= 0 ? 'text-long' : 'text-short'}`}>{formatSignedPct(stats.totalReturnPct)}</span>
        <button type="button" onClick={onAdd} disabled={added || !canAdd} className={`btn !rounded-md !px-1.5 !py-0.5 text-[10px] ${added ? 'border-long/30 bg-long/10 text-long' : 'btn-ghost'}`}>
          {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {added ? t('top.added') : t('top.add')}
        </button>
      </span>
    </motion.div>
  );
};

// "Find top 10 coins" ranks the most traded pairs; "Auto fill" also searches the best settings for them
const TopCoinsCard: React.FC<TopCoinsCardProps> = ({ config, disabled, onApply }) => {
  const { t, ttf } = useI18n();
  const { phase, busy, progress, coins, filled, failed, findTopCoins, autoFill } = useTopCoins(config, onApply);
  const locked = busy || disabled;
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const addCoin = (symbol: string) => {
    if (config.symbols.includes(symbol) || config.symbols.length >= MAX_COINS) return;
    onApply({ symbols: [...config.symbols, symbol] });
  };

  return (
    <Card title={t('top.title')} icon={<Sparkles className="h-4 w-4" />} delay={0.05}>
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('top.description', { count: UNIVERSE_SIZE })}</p>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={findTopCoins} disabled={locked} className="btn-ghost !py-2 text-xs">
            {phase === 'scanning' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('top.find')}
          </button>
          <button type="button" onClick={autoFill} disabled={locked} className="btn-primary !py-2 text-xs" title={t('top.autoFillHint')}>
            {phase === 'searching' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {t('top.autoFill')}
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">{t('top.autoFillHint')}</p>

        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>
                  {phase === 'scanning'
                    ? t('top.scanning', { symbol: progress.symbol ?? '', done: progress.done, total: progress.total })
                    : t('top.searching', { done: progress.done, total: progress.total })}
                </span>
                <span className="num text-slate-500">{percent}%</span>
              </div>
              <div dir="ltr" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.span className="block h-full rounded-full bg-gradient-to-r from-glow-cyan to-glow-violet" animate={{ width: `${percent}%` }} transition={{ ease: 'easeOut', duration: 0.3 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {failed && (
          <p className="flex items-start gap-2 rounded-lg border border-short/30 bg-short/10 px-2.5 py-2 text-[11px] text-short">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('top.error')}
          </p>
        )}

        {coins && coins.length === 0 && !busy && <p className="text-[11px] text-slate-500">{t('top.noResults')}</p>}

        {coins && coins.length > 0 && (
          <div className="space-y-1">
            {coins.map((coin) => (
              <CoinRow key={coin.symbol} coin={coin} added={config.symbols.includes(coin.symbol)} canAdd={config.symbols.length < MAX_COINS && !locked} onAdd={() => addCoin(coin.symbol)} />
            ))}
          </div>
        )}

        {filled && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-long/30 bg-long/10 px-2.5 py-2 text-[11px] leading-relaxed text-long">
            {t('top.filled', {
              combos: filled.combosTried,
              symbols: filled.config.symbols.join(', '),
              timeframe: ttf(filled.config.timeframe),
              exit: exitModeLabel(filled.config.exitMode, t),
              ret: formatSignedPct(filled.result.stats.totalReturnPct),
            })}
          </motion.p>
        )}
      </div>
    </Card>
  );
};

export default TopCoinsCard;
