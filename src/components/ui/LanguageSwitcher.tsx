import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Languages, Check } from 'lucide-react';
import { LANGUAGES, useI18n } from '../../i18n';

// Globe button that opens the list of supported languages
const LanguageSwitcher = () => {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost !px-2 !py-1.5 text-xs" title={t('nav.language')} aria-label={t('nav.language')}>
        <Languages className="h-3.5 w-3.5" />
        <span className="hidden uppercase sm:inline">{lang}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-full z-50 mt-1.5 w-40 rounded-xl border border-white/10 bg-ink-800/95 p-1 text-sm shadow-2xl backdrop-blur-xl"
          >
            {LANGUAGES.map((language) => (
              <li key={language.code}>
                <button
                  type="button"
                  dir={language.dir}
                  onClick={() => {
                    setLang(language.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-start transition-colors ${
                    language.code === lang ? 'bg-glow-cyan/15 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {language.label}
                  {language.code === lang && <Check className="h-3.5 w-3.5 text-glow-cyan" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
