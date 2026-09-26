import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, X, Check } from 'lucide-react';
import { getAppKey, setAppKey } from '../../services/api';
import { useI18n } from '../../i18n';
import Portal from './Portal';

// Asks for the Worker's APP_KEY once; it is kept in this browser only
const AppKeyDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useI18n();
  const [value, setValue] = useState(getAppKey);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setAppKey(value);
    setSaved(true);
    setTimeout(onClose, 700);
  };

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
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-glow-cyan/15 text-glow-cyan"><KeyRound className="h-4 w-4" /></span>
              {t('appkey.title')}
            </h2>
            <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label={t('common.close')}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="relative text-xs leading-relaxed text-slate-400">{t('appkey.intro')}</p>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder={t('appkey.placeholder')}
            autoComplete="off"
            className="field relative font-mono"
          />
          <button type="button" onClick={save} disabled={!value.trim()} className={`relative w-full !py-2.5 ${saved ? 'btn-success' : 'btn-primary'}`}>
            {saved ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {saved ? t('appkey.saved') : t('appkey.save')}
          </button>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default AppKeyDialog;
