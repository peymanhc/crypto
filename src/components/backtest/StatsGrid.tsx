import { Activity, Target, Percent, Trophy, Skull, Coins, Clock, TrendingUp } from 'lucide-react';
import { BacktestStats } from '../../types/backtest';
import { formatSignedPct, formatPct, formatDuration } from '../../lib/format';
import Stat from '../ui/Stat';
import { useI18n } from '../../i18n';

// The eight KPI tiles under the verdict banner
const StatsGrid: React.FC<{ stats: BacktestStats }> = ({ stats }) => {
  const { t } = useI18n();
  const rewardToRisk = stats.avgLossPct !== 0 ? (stats.avgWinPct / Math.abs(stats.avgLossPct)).toFixed(2) : '—';
  const profitFactor = Number.isFinite(stats.profitFactor) ? stats.profitFactor : 99;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label={t('bt.stat.trades')} value={stats.trades} format={(n) => Math.round(n).toString()} hint={t('bt.stat.tradesHint', { longs: stats.longs, shorts: stats.shorts })} icon={<Activity className="h-4 w-4" />} />
      <Stat label={t('bt.stat.winRate')} value={stats.winRate} format={formatPct} tone={stats.winRate >= 50 ? 'good' : 'bad'} hint={t('bt.stat.winRateHint', { wins: stats.wins, losses: stats.losses })} icon={<Target className="h-4 w-4" />} />
      <Stat label={t('bt.stat.expectancy')} value={stats.expectancyPct} format={formatSignedPct} tone="auto" hint={t('bt.stat.expectancyHint')} icon={<Percent className="h-4 w-4" />} />
      <Stat label={t('bt.stat.profitFactor')} value={profitFactor} format={(n) => (n >= 99 ? '∞' : n.toFixed(2))} tone={profitFactor >= 1.5 ? 'good' : profitFactor >= 1 ? 'neutral' : 'bad'} hint={t('bt.stat.profitFactorHint')} icon={<Trophy className="h-4 w-4" />} />
      <Stat label={t('bt.stat.drawdown')} value={-stats.maxDrawdownPct} format={formatSignedPct} tone="bad" hint={t('bt.stat.drawdownHint')} icon={<Skull className="h-4 w-4" />} />
      <Stat label={t('bt.stat.avgWinLoss')} value={stats.avgWinPct} format={(n) => `${formatSignedPct(n)} / ${formatSignedPct(stats.avgLossPct)}`} hint={t('bt.stat.rr', { value: rewardToRisk })} icon={<Coins className="h-4 w-4" />} />
      <Stat label={t('bt.stat.avgHold')} value={stats.avgHoldMs} format={formatDuration} hint={t('bt.stat.avgHoldHint', { count: stats.maxConsecutiveLosses })} icon={<Clock className="h-4 w-4" />} />
      <Stat label={t('bt.stat.bestWorst')} value={stats.bestPct} format={(n) => `${formatSignedPct(n)} / ${formatSignedPct(stats.worstPct)}`} hint={t('bt.stat.skipped', { count: stats.skippedByRisk })} icon={<TrendingUp className="h-4 w-4" />} />
    </div>
  );
};

export default StatsGrid;
