import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, KeyRound, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import Logo from '../components/ui/Logo';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import Field from '../components/ui/Field';

// Full-page login: username + password for users, the app key for the admin
function LoginPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message === 'bad credentials' ? t('login.badCredentials') : message === 'disabled' ? t('login.disabled') : message === 'expired' ? t('login.expired') : t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="glass w-full max-w-sm p-6">
        <div className="relative mb-5 flex items-center justify-between">
          <Logo />
          <LanguageSwitcher />
        </div>
        <h1 className="relative font-display text-xl font-semibold text-white">{t('login.title')}</h1>
        <p className="relative mt-1 text-xs text-slate-500">{t('login.intro')}</p>

        <form
          className="relative mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => auth.loginUser(username, password));
          }}
        >
          <Field label={t('login.username')}>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" className="field" />
          </Field>
          <Field label={t('login.password')}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="field" />
          </Field>
          <button type="submit" disabled={busy || !username || !password} className="btn-primary w-full !py-2.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {t('login.submit')}
          </button>
        </form>

        <button type="button" onClick={() => setShowAdmin((s) => !s)} className="relative mt-4 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300">
          {t('login.adminToggle')}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdmin ? 'rotate-180' : ''}`} />
        </button>
        {showAdmin && (
          <form
            className="relative mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => auth.loginAdmin(adminKey));
            }}
          >
            <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder={t('appkey.placeholder')} autoComplete="off" className="field font-mono" />
            <button type="submit" disabled={busy || !adminKey.trim()} className="btn-ghost w-full">
              <KeyRound className="h-4 w-4" /> {t('login.adminSubmit')}
            </button>
          </form>
        )}

        {error && <p className="relative mt-3 rounded-lg border border-short/30 bg-short/10 px-2.5 py-2 text-[11px] text-short">{error}</p>}
      </motion.div>
    </div>
  );
}

export default LoginPage;
