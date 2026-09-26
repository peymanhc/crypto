import { ShieldCheck, Users, RefreshCw, Wallet } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAdminUsers } from '../hooks/useAdminUsers';
import PageTitle from '../components/ui/PageTitle';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import CreateUserForm from '../components/admin/CreateUserForm';
import UserRow from '../components/admin/UserRow';

const usd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

// Admin only: create users, cut their access, and see everyone's Hyperliquid PnL
function AdminPage() {
  const { t } = useI18n();
  const { users, pnl, totalNet, error, busy, refresh, create, update } = useAdminUsers();
  const admin = users?.find((u) => u.username === 'admin');
  const members = users?.filter((u) => u.username !== 'admin') ?? [];
  const adminPnl = pnl.admin;

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow={<><ShieldCheck className="h-3.5 w-3.5" /> {t('admin.eyebrow')}</>}
        eyebrowColor="text-glow-amber"
        title={<>{t('admin.title.a')} <span className="gradient-text">{t('admin.title.b')}</span></>}
        description={t('admin.description')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <CreateUserForm onCreate={create} />
          <Card title={t('admin.pnlTitle')} icon={<Wallet className="h-4 w-4" />} hover={false}>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                <span className="text-slate-300">{t('admin.pnlMine')}</span>
                <span className={`num font-semibold ${(adminPnl?.net ?? 0) >= 0 ? 'text-long' : 'text-short'}`}>
                  {admin?.hlAddresses.length ? (adminPnl ? usd(adminPnl.net) : '…') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                <span className="text-slate-300">{t('admin.pnlAll')}</span>
                <span className={`num font-semibold ${totalNet >= 0 ? 'text-long' : 'text-short'}`}>{usd(totalNet)}</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">{t('admin.pnlHint')}</p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card
            title={t('admin.users', { count: members.length })}
            icon={<Users className="h-4 w-4" />}
            hover={false}
            right={
              <button type="button" onClick={refresh} className="btn-ghost !p-1.5" aria-label={t('hl.account.refresh')}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            }
          >
            {error && <p className="mb-2 rounded-lg border border-short/30 bg-short/10 px-2.5 py-1.5 text-[11px] text-short">{error}</p>}
            {users === null ? (
              <Skeleton lines={5} />
            ) : members.length === 0 ? (
              <p className="text-xs text-slate-500">{t('admin.empty')}</p>
            ) : (
              <div className="space-y-2">
                {members.map((user) => (
                  <UserRow key={user.username} user={user} pnl={pnl[user.username]} busy={busy === user.username} onAction={(action, expiresAt) => update(user.username, action, expiresAt)} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
