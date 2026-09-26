import { useState } from 'react';
import { Wallet, KeyRound, LogOut, Loader2, ShieldAlert } from 'lucide-react';
import { HlNetwork, HlSession } from '../../types/hyperliquid';
import { hasBrowserWallet } from '../../lib/hyperliquid/wallet';
import { useI18n } from '../../i18n';
import Card from '../ui/Card';
import Field from '../ui/Field';
import { hlErrorText } from './errors';
import OpenInWallet from './OpenInWallet';

interface LoginCardProps {
  session: HlSession | null;
  busy: boolean;
  error: string | null;
  onWallet: (network: HlNetwork) => void;
  onApiKey: (network: HlNetwork, address: string, key: string) => void;
  onLogout: () => void;
}

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

// Login (browser wallet or pasted API key) and the logged-in summary
const LoginCard: React.FC<LoginCardProps> = ({ session, busy, error, onWallet, onApiKey, onLogout }) => {
  const { t } = useI18n();
  const [network, setNetwork] = useState<HlNetwork>('testnet');
  const [mode, setMode] = useState<'wallet' | 'apiKey'>(hasBrowserWallet() ? 'wallet' : 'apiKey');
  const [address, setAddress] = useState('');
  const [key, setKey] = useState('');

  if (session) {
    return (
      <Card title={t('hl.login.title')} icon={<Wallet className="h-4 w-4" />} hover={false} right={
        <span className={`chip ${session.network === 'testnet' ? 'border-glow-amber/40 bg-glow-amber/10 text-glow-amber' : 'border-long/40 bg-long/10 text-long'}`}>
          {t(`hl.network.${session.network}`)}
        </span>
      }>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="num text-white">{shorten(session.mainAddress)}</p>
            <p className="text-[11px] text-slate-500">{t(`hl.login.mode.${session.mode}`)}</p>
          </div>
          <button type="button" onClick={onLogout} className="btn-danger !py-1.5 text-xs">
            <LogOut className="h-3.5 w-3.5" /> {t('hl.login.logout')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('hl.login.title')} icon={<Wallet className="h-4 w-4" />} hover={false}>
      <div className="space-y-3.5">
        <p className="text-[11px] leading-relaxed text-slate-500">{t('hl.login.intro')}</p>

        <Field label={t('hl.network.label')}>
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 text-xs">
            {(['testnet', 'mainnet'] as HlNetwork[]).map((n) => (
              <button key={n} type="button" onClick={() => setNetwork(n)} className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${network === n ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {t(`hl.network.${n}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 text-xs">
          <button type="button" onClick={() => setMode('wallet')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${mode === 'wallet' ? 'bg-white/[0.1] text-white' : 'text-slate-400'}`}>
            <Wallet className="h-3.5 w-3.5" /> {t('hl.login.wallet')}
          </button>
          <button type="button" onClick={() => setMode('apiKey')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${mode === 'apiKey' ? 'bg-white/[0.1] text-white' : 'text-slate-400'}`}>
            <KeyRound className="h-3.5 w-3.5" /> {t('hl.login.apiKey')}
          </button>
        </div>

        {mode === 'wallet' ? (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-500">{t('hl.login.walletHint')}</p>
            <button type="button" onClick={() => onWallet(network)} disabled={busy || !hasBrowserWallet()} className="btn-primary w-full !py-2.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {t('hl.login.connect')}
            </button>
            {!hasBrowserWallet() && (
              <>
                <p className="text-[11px] text-glow-amber">{t('hl.login.noWallet')}</p>
                <OpenInWallet />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-500">{t('hl.login.apiKeyHint')}</p>
            <Field label={t('hl.login.address')}>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} className="field !py-1.5 font-mono text-xs" />
            </Field>
            <Field label={t('hl.login.key')}>
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="0x…" autoComplete="off" className="field !py-1.5 font-mono text-xs" />
            </Field>
            <button type="button" onClick={() => onApiKey(network, address, key)} disabled={busy || !address || !key} className="btn-primary w-full !py-2.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t('hl.login.save')}
            </button>
          </div>
        )}

        {error && <p className="rounded-lg border border-short/30 bg-short/10 px-2.5 py-2 text-[11px] text-short">{hlErrorText(error, t)}</p>}

        <p className="flex items-start gap-2 rounded-xl border border-glow-amber/20 bg-glow-amber/[0.06] p-3 text-[11px] leading-relaxed text-slate-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-glow-amber" /> {t('hl.login.security')}
        </p>
      </div>
    </Card>
  );
};

export default LoginCard;
