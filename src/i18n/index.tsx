import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en, { Dictionary, TranslationKey } from './locales/en';
import fr from './locales/fr';
import ja from './locales/ja';
import ru from './locales/ru';
import tr from './locales/tr';
import fa from './locales/fa';

export type Lang = 'en' | 'fr' | 'ja' | 'ru' | 'tr' | 'fa';
export type Direction = 'ltr' | 'rtl';

export const LANGUAGES: { code: Lang; label: string; dir: Direction }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'fa', label: 'فارسی', dir: 'rtl' },
];

const dictionaries: Record<Lang, Dictionary> = { en, fr, ja, ru, tr, fa };
const STORAGE_KEY = 'language';

const isLang = (value: unknown): value is Lang => LANGUAGES.some((l) => l.code === value);

// Saved choice, else the browser language if we support it, else English
const initialLang = (): Lang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage unavailable
  }
  const browser = navigator.language.slice(0, 2);
  return isLang(browser) ? browser : 'en';
};

type Vars = Record<string, string | number>;

export interface I18n {
  lang: Lang;
  dir: Direction;
  setLang: (lang: Lang) => void;
  // t('form.pairs', { count: 5 }) -> "5 pairs"
  t: (key: TranslationKey, vars?: Vars) => string;
  // Translates a raw value from the analysis engine ("Uptrend") when we have a translation for it
  tv: (value: string | undefined) => string;
  // "15m" -> "15 min" in the current language
  ttf: (timeframe: string) => string;
  // Translates a known status message ("Pick at least one coin.") and leaves unknown ones as they are
  tm: (message: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

const fill = (text: string, vars?: Vars): string =>
  vars ? text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`)) : text;

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr';

  // Keep <html lang dir> in sync so the whole page (scrollbars, inputs, fonts) follows
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[lang];
    const t: I18n['t'] = (key, vars) => fill(dict[key] ?? en[key] ?? key, vars);
    const tv: I18n['tv'] = (raw) => {
      if (!raw) return '';
      const key = `value.${raw}` as TranslationKey;
      return dict[key] ?? raw;
    };
    const lookup = (prefix: string, raw: string): string => dict[`${prefix}.${raw}` as TranslationKey] ?? raw;
    const ttf: I18n['ttf'] = (timeframe) => lookup('tf', timeframe);
    const tm: I18n['tm'] = (message) => lookup('msg', message);
    const setLang = (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // storage unavailable
      }
    };
    return { lang, dir, setLang, t, tv, ttf, tm };
  }, [lang, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18n => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
};
