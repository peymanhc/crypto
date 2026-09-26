import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, RefreshCw } from 'lucide-react';
import { HlAccount, HlPosition } from '../../types/hyperliquid';
import { formatPrice, formatSignedPct } from '../../lib/format';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import { DirectionBadge } from '../ui/Badge';
import { hlErrorText } from './errors';

interface AccountCardProps {
  account: HlAccount | null;
  error: string | null;
  closing: string | null;
  onRefresh: () => void;
  onClose: (position: HlPosition) => void;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

// One open position with its PnL and a Close button
const PositionRow: React.FC<{ position: HlPosition; closing: boolean; onClose: () => void }> = ({ position, closing, onClose }) => {
  const { t } = useI18n();
  const margin = position.positionValue / Math.max(1, position.leverage);
  const pnlPct = margin > 0 ? (position.unrealizedPnl / margin) * 100 : 0;
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs">
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-mono font-semibold text-white">{position.coin}</span>
          <DirectionBadge direction={position.direction} />
        </span>
        <span className="num block text-[10px] text-slate-500">
          {position.size} @ {formatPrice(position.entryPx)} · {position.leverage}x
          {position.liquidationPx !== null && ` · liq ${formatPrice(position.liquidationPx)}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`num text-end font-semibold ${position.unrealizedPnl >= 0 ? 'text-long' : 'text-short'}`}>
          {usd(position.unrealizedPnl)}
          <span className="block text-[10px] font-normal opacity-80">{formatSignedPct(pnlPct)}</span>
        </span>
        <button type="button" onClick={onClose} disabled={closing} className="btn-danger !rounded-md !px-2 !py-1 text-[10px]">
          {closing ? '…' : t('hl.account.close')}
        </button>
      </span>
    </motion.div>
  );
};

// Balance summary and the list of open positions
const AccountCard: React.FC<AccountCardProps> = ({ account, error, closing, onRefresh, onClose }) => {
  const { t } = useI18n();
  return (
    <Card
      title={t('hl.account.title')}
      icon={<PieChart className="h-4 w-4" />}
      hover={false}
      right={
        <button type="button" onClick={onRefresh} className="btn-ghost !p-1.5" aria-label={t('hl.account.refresh')}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      }
    >
      {error && <p className="mb-2 rounded-lg border border-short/30 bg-short/10 px-2.5 py-1.5 text-[11px] text-short">{hlErrorText(error, t)}</p>}
      {!account ? (
        <Skeleton lines={4} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['hl.account.value', account.accountValue],
              ['hl.account.withdrawable', account.withdrawable],
              ['hl.account.marginUsed', account.marginUsed],
            ].map(([key, value]) => (
              <div key={key as string} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t(key as 'hl.account.value')}</p>
                <p className="num text-sm font-semibold text-white">{usd(value as number)}</p>
              </div>
            ))}
          </div>
          {account.accountValue === 0 && (
            <p className="rounded-lg border border-glow-amber/30 bg-glow-amber/10 px-2.5 py-2 text-[11px] leading-relaxed text-glow-amber">{t('hl.error.mustDeposit')}</p>
          )}
          <div>
            <p className="label">{t('hl.account.positions', { count: account.positions.length })}</p>
            {account.positions.length === 0 ? (
              <p className="text-xs text-slate-500">{t('hl.account.noPositions')}</p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence>
                  {account.positions.map((p) => (
                    <PositionRow key={p.coin} position={p} closing={closing === p.coin} onClose={() => onClose(p)} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default AccountCard;
