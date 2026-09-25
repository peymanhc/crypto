import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BacktestTrade } from '../../types/backtest';
import TradeRow from './TradeRow';
import { useI18n } from '../../i18n';
import { TranslationKey } from '../../i18n/locales/en';

const PAGE_SIZE = 25;
const COLUMNS: (TranslationKey | '#')[] = ['#', 'bt.col.coin', 'bt.col.side', 'bt.col.opened', 'bt.col.entryExit', 'bt.col.lev', 'bt.col.hold', 'bt.col.exitBy', 'bt.col.pnl', 'bt.col.equity'];

// Full trade log, newest first, 25 rows at a time
const TradeTable: React.FC<{ trades: BacktestTrade[] }> = ({ trades }) => {
  const [shown, setShown] = useState(PAGE_SIZE);
  const { t } = useI18n();
  const newestFirst = [...trades].reverse();
  const maxAbsPnl = Math.max(1, ...trades.map((t) => Math.abs(t.pnlPct)));
  const remaining = newestFirst.length - shown;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[720px] text-start text-[12px]">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className={`px-3 py-2 font-semibold ${column === 'bt.col.pnl' ? 'text-end' : ''}`}>{column === '#' ? '#' : t(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {newestFirst.slice(0, shown).map((trade, i) => (
              <TradeRow key={`${trade.symbol}-${trade.openedAt}`} trade={trade} number={trades.length - i} maxAbsPnl={maxAbsPnl} delay={Math.min(i, 20) * 0.02} />
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button type="button" onClick={() => setShown((s) => s + PAGE_SIZE)} className="btn-ghost w-full text-xs">
          <ChevronDown className="h-3.5 w-3.5" /> {t('bt.showMore', { count: Math.min(PAGE_SIZE, remaining), remaining })}
        </button>
      )}
    </div>
  );
};

export default TradeTable;
