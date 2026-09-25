import { Coins } from 'lucide-react';
import { BacktestResult } from '../../types/backtest';
import { formatSignedPct } from '../../lib/format';
import Card from '../ui/Card';
import { useI18n } from '../../i18n';

// One row per coin: trades, win rate, and the sum of its trade PnL
const PerCoinList: React.FC<{ result: BacktestResult }> = ({ result }) => {
  const { t } = useI18n();
  return (
  <Card hover={false} title={t('bt.perCoin')} icon={<Coins className="h-4 w-4" />}>
    <div className="space-y-1.5">
      {result.perSymbol.map((coin) => (
        <div key={coin.symbol} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs">
          <span className="font-mono text-slate-200">{coin.symbol}</span>
          <span className="flex items-center gap-3 text-slate-400">
            <span>{t('bt.perCoin.trades', { count: coin.trades })}</span>
            <span>{t('bt.perCoin.win', { pct: coin.winRate.toFixed(0) })}</span>
            <span className={`num font-semibold ${coin.pnlPct >= 0 ? 'text-long' : 'text-short'}`} title={t('bt.perCoin.sum')}>
              Σ {formatSignedPct(coin.pnlPct)}
            </span>
          </span>
        </div>
      ))}
    </div>
  </Card>
  );
};

export default PerCoinList;
