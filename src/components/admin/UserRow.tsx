import { useState } from 'react';
import { Ban, CheckCircle2, Trash2, CalendarPlus } from 'lucide-react';
import { ManagedUser } from '../../services/auth';
import { PnlSummary } from '../../lib/hyperliquid/pnl';
import { formatDay } from '../../lib/format';
import { useI18n } from '../../i18n';

interface UserRowProps {
  user: ManagedUser;
  pnl: PnlSummary | null | undefined;
  busy: boolean;
  onAction: (action: 'disable' | 'enable' | 'delete' | 'extend', expiresAt?: number) => void;
}

const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

// One managed user: status, expiry, Hyperliquid PnL and the admin actions
const UserRow: React.FC<UserRowProps> = ({ user, pnl, busy, onAction }) => {
  const { t } = useI18n();
  const [extendTo, setExtendTo] = useState('');
  const expired = user.expiresAt !== null && user.expiresAt < Date.now();
  const status = user.disabled ? 'disabled' : expired ? 'expired' : 'active';
  const statusChip = status === 'active' ? 'border-long/30 bg-long/10 text-long' : status === 'expired' ? 'border-glow-amber/30 bg-glow-amber/10 text-glow-amber' : 'border-short/30 bg-short/10 text-short';

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-white">{user.username}</span>
          <span className={`chip ${statusChip}`}>{t(`admin.status.${status}`)}</span>
        </span>
        <span className="text-[11px] text-slate-500">
          {user.expiresAt ? t('admin.expiresOn', { date: formatDay(user.expiresAt) }) : '—'}
          {user.lastLoginAt && ` · ${t('admin.lastLogin', { date: formatDay(user.lastLoginAt) })}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">
          {user.hlAddresses.length === 0
            ? t('admin.noHl')
            : pnl === undefined
              ? t('admin.pnlLoading')
              : pnl === null
                ? t('admin.pnlError')
                : (
                  <>
                    {t('admin.pnl')}: <span className={`num font-semibold ${pnl.net >= 0 ? 'text-long' : 'text-short'}`}>{usd(pnl.net)}</span>
                    <span className="text-slate-500"> · {t('admin.fills', { count: pnl.fills })}</span>
                  </>
                )}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <input type="date" value={extendTo} onChange={(e) => setExtendTo(e.target.value)} className="field !w-36 !px-2 !py-1 text-[11px]" aria-label={t('admin.extend')} />
          <button type="button" disabled={busy || !extendTo} onClick={() => onAction('extend', new Date(`${extendTo}T23:59:59`).getTime())} className="btn-ghost !px-2 !py-1 text-[11px]" title={t('admin.extend')}>
            <CalendarPlus className="h-3.5 w-3.5" /> {t('admin.extend')}
          </button>
          {user.disabled ? (
            <button type="button" disabled={busy} onClick={() => onAction('enable')} className="btn-success !px-2 !py-1 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('admin.enable')}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => onAction('disable')} className="btn-danger !px-2 !py-1 text-[11px]">
              <Ban className="h-3.5 w-3.5" /> {t('admin.disable')}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => window.confirm(t('admin.confirmDelete', { name: user.username })) && onAction('delete')} className="btn-ghost !px-2 !py-1 text-[11px] text-short" title={t('admin.delete')} aria-label={t('admin.delete')}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
};

export default UserRow;
