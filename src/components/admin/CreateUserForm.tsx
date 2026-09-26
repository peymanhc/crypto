import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Field from '../ui/Field';

interface CreateUserFormProps {
  onCreate: (username: string, password: string, expiresAt: number) => Promise<void>;
}

// Local "YYYY-MM-DD" -> end of that day as a timestamp
const endOfDay = (date: string): number => new Date(`${date}T23:59:59`).getTime();

const inDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// New user: name, password and the date their access ends
const CreateUserForm: React.FC<CreateUserFormProps> = ({ onCreate }) => {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [expires, setExpires] = useState(() => inDays(30));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate(username.trim(), password, endOfDay(expires));
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('admin.create')} icon={<UserPlus className="h-4 w-4" />} hover={false}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t('login.username')} hint={t('admin.usernameHint')}>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="off" className="field !py-1.5 text-sm" />
        </Field>
        <Field label={t('login.password')} hint={t('admin.passwordHint')}>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="field !py-1.5 font-mono text-sm" />
        </Field>
        <Field label={t('admin.expires')} hint={t('admin.expiresHint')}>
          <div className="flex items-center gap-1.5">
            <input type="date" value={expires} min={inDays(1)} onChange={(e) => setExpires(e.target.value)} className="field min-w-0 flex-1 !py-1.5 text-sm" />
            {[7, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => setExpires(inDays(days))} className="btn-ghost !px-2 !py-1.5 text-[11px]">
                {days}d
              </button>
            ))}
          </div>
        </Field>
        <button type="submit" disabled={busy || username.trim().length < 3 || password.length < 6} className="btn-primary w-full !py-2.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {t('admin.createButton')}
        </button>
        {error && <p className="rounded-lg border border-short/30 bg-short/10 px-2.5 py-2 text-[11px] text-short">{error}</p>}
      </form>
    </Card>
  );
};

export default CreateUserForm;
