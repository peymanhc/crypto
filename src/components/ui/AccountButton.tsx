import { LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { formatDay } from '../../lib/format';

// Who is signed in, and the sign-out button
const AccountButton = () => {
  const { t } = useI18n();
  const { role, username, expiresAt, logout } = useAuth();
  if (!role) return null;
  const title = `${t('account.signedInAs', { name: username })}${expiresAt ? ` · ${t('account.expires', { date: formatDay(expiresAt) })}` : ''}`;
  return (
    <span className="flex items-center gap-1">
      <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 sm:flex" title={title}>
        {role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-glow-amber" /> : <User className="h-3.5 w-3.5 text-glow-cyan" />}
        {username}
      </span>
      <button type="button" onClick={logout} className="btn-ghost !px-2 !py-1.5 text-xs" title={t('account.logout')} aria-label={t('account.logout')}>
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </span>
  );
};

export default AccountButton;
