import { motion } from 'framer-motion';
import { BacktestTrade, BacktestCloseReason } from '../../types/backtest';
import { formatPrice, formatDateTime, formatDuration } from '../../lib/format';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

const reasonLabel: Record<BacktestCloseReason, TranslationKey> = {
  stop: 'bt.reason.stop',
  profit: 'bt.reason.profit',
  tp: 'bt.reason.tp',
  expired: 'bt.reason.expired',
  end: 'bt.reason.end',
};

const reasonColor: Record<BacktestCloseReason, string> = {
  stop: 'text-short',
  profit: 'text-long',
  tp: 'text-long',
  expired: 'text-glow-amber',
  end: 'text-slate-400',
};

// Tiny bar growing right for a win and left for a loss, relative to the biggest trade
const PnlBar: React.FC<{ pnlPct: number; maxAbs: number }> = ({ pnlPct, maxAbs }) => {
  const win = pnlPct > 0;
  const width = (Math.abs(pnlPct) / maxAbs) * 50;
  return (
    <span dir="ltr" className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
      <span className={`absolute inset-y-0 rounded-full ${win ? 'left-1/2 bg-long' : 'right-1/2 bg-short'}`} style={{ width: `${width}%` }} />
    </span>
  );
};

interface TradeRowProps {
  trade: BacktestTrade;
  number: number;
  maxAbsPnl: number;
  delay: number;
}

const TradeRow: React.FC<TradeRowProps> = ({ trade, number, maxAbsPnl, delay }) => {
  const { t } = useI18n();
  const win = trade.pnlPct > 0;
  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }} className="hover:bg-white/[0.03]">
      <td className="px-3 py-2 text-slate-500">{number}</td>
      <td className="px-3 py-2 font-mono text-slate-200">{trade.base}</td>
      <td className={`px-3 py-2 font-semibold ${trade.direction === 'Long' ? 'text-long' : 'text-short'}`}>{t(trade.direction === 'Long' ? 'common.long' : 'common.short')}</td>
      <td className="px-3 py-2 text-slate-400">{formatDateTime(trade.openedAt)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatPrice(trade.entry)} → {formatPrice(trade.exitPrice)}</td>
      <td className="px-3 py-2 text-slate-400">{trade.leverage}x</td>
      <td className="px-3 py-2 text-slate-400">{formatDuration(trade.holdMs)}</td>
      <td className={`px-3 py-2 ${reasonColor[trade.reason]}`}>{t(reasonLabel[trade.reason])}</td>
      <td className="px-3 py-2 text-end">
        <div className="flex items-center justify-end gap-2">
          <PnlBar pnlPct={trade.pnlPct} maxAbs={maxAbsPnl} />
          <span className={`num font-semibold ${win ? 'text-long' : 'text-short'}`}>{win ? '+' : ''}{trade.pnlPct.toFixed(2)}%</span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-slate-300">{trade.equityAfter.toFixed(2)}</td>
    </motion.tr>
  );
};

export default TradeRow;
