import { motion } from 'framer-motion';
import { X, Download, Smartphone, Monitor, Share } from 'lucide-react';
import { useI18n } from '../../i18n';
import Portal from './Portal';

interface InstallDialogProps {
  canPrompt: boolean;
  onInstall: () => void;
  onClose: () => void;
}

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

// Explains how to install on the current device, with the one-click prompt when the browser offers it
const InstallDialog: React.FC<InstallDialogProps> = ({ canPrompt, onInstall, onClose }) => {
  const { t } = useI18n();
  const steps = [
    { key: 'install.ios' as const, icon: <Share className="h-4 w-4" />, active: isIos() },
    { key: 'install.android' as const, icon: <Smartphone className="h-4 w-4" />, active: isAndroid() },
    { key: 'install.desktop' as const, icon: <Monitor className="h-4 w-4" />, active: !isIos() && !isAndroid() },
  ];

  return (
    <Portal>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="glass w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.25rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-glow-cyan/15 text-glow-cyan"><Download className="h-4 w-4" /></span>
            {t('install.title')}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label={t('install.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="relative text-sm text-slate-400">{t('install.intro')}</p>

        {canPrompt && (
          <button type="button" onClick={onInstall} className="btn-primary relative w-full !py-2.5">
            <Download className="h-4 w-4" /> {t('install.button')}
          </button>
        )}

        <ul className="relative space-y-2">
          {steps.map((step) => (
            <li key={step.key} className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${step.active ? 'border-glow-cyan/30 bg-glow-cyan/[0.07] text-slate-200' : 'border-white/[0.06] bg-white/[0.02] text-slate-500'}`}>
              <span className={`mt-0.5 shrink-0 ${step.active ? 'text-glow-cyan' : ''}`}>{step.icon}</span>
              {t(step.key)}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
    </Portal>
  );
};

export default InstallDialog;
