import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { HlFill, HlOpenOrder } from '../../types/hyperliquid';
import { formatDateTime, formatPrice } from '../../lib/format';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import { hlErrorText } from './errors';

interface HistoryCardProps {
  fills: HlFill[];
  orders: HlOpenOrder[];
  loaded: boolean;
  error: string | null;
  cancelling: number | null;
  onRefresh: () => void;
  onCancel: (order: HlOpenOrder) => void;
}

const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

// One executed fill: direction as the exchange words it, size @ price, closed PnL and fee
const FillRow: React.FC<{ fill: HlFill }> = ({ fill }) => {
  const { t } = useI18n();
  const isBuy = fill.side === 'buy';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
      <span className="min-w-0">
        <span className="font-mono font-semibold text-white">{fill.coin}</span>
        <span className={`ms-1.5 ${isBuy ? 'text-long' : 'text-short'}`}>{fill.dir}</span>
        <span className="num block text-[10px] text-slate-500">
          {fill.size} @ {formatPrice(fill.price)} · {t('hl.history.fee')} ${fill.fee.toFixed(4)}
        </span>
      </span>
      <span className="shrink-0 text-end">
        {fill.closedPnl !== 0 && <span className={`num block font-semibold ${fill.closedPnl >= 0 ? 'text-long' : 'text-short'}`}>{usd(fill.closedPnl)}</span>}
        <span className="block text-[10px] text-slate-500">{formatDateTime(fill.time)}</span>
      </span>
    </div>
  );
};

// One resting order (limit or TP / SL trigger) with a Cancel button
const OrderRow: React.FC<{ order: HlOpenOrder; cancelling: boolean; onCancel: () => void }> = ({ order, cancelling, onCancel }) => {
  const { t } = useI18n();
  const isBuy = order.side === 'buy';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
      <span className="min-w-0">
        <span className="font-mono font-semibold text-white">{order.coin}</span>
        <span className={`ms-1.5 ${isBuy ? 'text-long' : 'text-short'}`}>{isBuy ? t('common.long') : t('common.short')}</span>
        {order.isTrigger && <span className="chip ms-1.5 border-glow-amber/30 bg-glow-amber/10 text-[9px] text-glow-amber">{t('hl.history.trigger')}</span>}
        {order.reduceOnly && <span className="chip ms-1 border-white/10 bg-white/[0.05] text-[9px] text-slate-400">{t('hl.history.reduceOnly')}</span>}
        <span className="num block text-[10px] text-slate-500">
          {order.size} @ {formatPrice(order.limitPx)}
          {order.isTrigger && order.triggerPx !== null && ` · ${order.triggerCondition} ${formatPrice(order.triggerPx)}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] text-slate-500">{formatDateTime(order.timestamp)}</span>
        <button type="button" onClick={onCancel} disabled={cancelling} className="btn-danger !rounded-md !px-2 !py-1 text-[10px]">
          {cancelling ? '…' : t('hl.history.cancel')}
        </button>
      </span>
    </div>
  );
};

// The exchange's own record of this account: executed fills and resting orders
const HistoryCard: React.FC<HistoryCardProps> = ({ fills, orders, loaded, error, cancelling, onRefresh, onCancel }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'fills' | 'orders'>('fills');

  const tabs = (
    <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 text-[11px]">
      {(['fills', 'orders'] as const).map((key) => (
        <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-md px-2.5 py-1 font-medium transition-colors ${tab === key ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          {t(`hl.history.${key}`)} ({key === 'fills' ? fills.length : orders.length})
        </button>
      ))}
      <button type="button" onClick={onRefresh} className="btn-ghost !border-0 !bg-transparent !p-1.5" aria-label={t('hl.history.refresh')}>
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <Card title={t('hl.history.title')} icon={<History className="h-4 w-4" />} hover={false} right={tabs}>
      {error && <p className="mb-2 rounded-lg border border-short/30 bg-short/10 px-2.5 py-1.5 text-[11px] text-short">{hlErrorText(error, t)}</p>}
      {!loaded ? (
        <Skeleton lines={4} />
      ) : tab === 'fills' ? (
        fills.length === 0 ? (
          <p className="text-xs text-slate-500">{t('hl.history.empty')}</p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto">{fills.map((f) => <FillRow key={`${f.hash}-${f.oid}-${f.time}`} fill={f} />)}</div>
        )
      ) : orders.length === 0 ? (
        <p className="text-xs text-slate-500">{t('hl.history.noOrders')}</p>
      ) : (
        <div className="max-h-96 space-y-1 overflow-y-auto">{orders.map((o) => <OrderRow key={o.oid} order={o} cancelling={cancelling === o.oid} onCancel={() => onCancel(o)} />)}</div>
      )}
    </Card>
  );
};

export default HistoryCard;
