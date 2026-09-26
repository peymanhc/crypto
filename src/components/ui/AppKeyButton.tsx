import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { getAppKey } from '../../services/api';
import { useI18n } from '../../i18n';
import AppKeyDialog from './AppKeyDialog';

// Header button for the Worker app key; shows a red dot until one is saved
const AppKeyButton = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState(() => getAppKey() !== '');

  const close = () => {
    setOpen(false);
    setHasKey(getAppKey() !== '');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost relative !px-2 !py-1.5 text-xs" title={t('appkey.title')} aria-label={t('appkey.title')}>
        <KeyRound className="h-3.5 w-3.5" />
        {!hasKey && <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-short" />}
      </button>
      <AnimatePresence>{open && <AppKeyDialog onClose={close} />}</AnimatePresence>
    </>
  );
};

export default AppKeyButton;
