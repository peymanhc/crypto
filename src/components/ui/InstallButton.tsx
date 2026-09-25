import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Download, Check } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { useI18n } from '../../i18n';
import InstallDialog from './InstallDialog';

// Always visible until the app is installed: opens the browser prompt when available,
// otherwise a dialog with per-device instructions
const InstallButton = () => {
  const { t } = useI18n();
  const { canPrompt, installed, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  if (installed) {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
        <Check className="h-3.5 w-3.5 text-long" /> {t('nav.installed')}
      </span>
    );
  }

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) setOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost !py-1.5 text-xs" title={t('nav.install')}>
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('nav.install')}</span>
      </button>
      <AnimatePresence>
        {open && <InstallDialog canPrompt={canPrompt} onInstall={handleInstall} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
};

export default InstallButton;
