import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n';

// Deep links that open the current page inside a mobile wallet's own browser,
// where the wallet is injected and "Connect wallet" works
const links = () => {
  const full = window.location.href;
  const bare = full.replace(/^https?:\/\//, '');
  return [
    { name: 'MetaMask', href: `https://metamask.app.link/dapp/${bare}` },
    { name: 'Trust Wallet', href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(full)}` },
    { name: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(full)}` },
  ];
};

const OpenInWallet = () => {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-relaxed text-slate-500">{t('hl.login.openInWallet')}</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {links().map((link) => (
          <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-1.5 text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> {link.name}
          </a>
        ))}
      </div>
    </div>
  );
};

export default OpenInWallet;
