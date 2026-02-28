import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US/common.json';
import trTR from './locales/tr-TR/common.json';

/** Supported locales with display names */
export const SUPPORTED_LOCALES = [
  { code: 'en-US', label: 'English (en-US)' },
  { code: 'tr-TR', label: 'Türkçe (tr-TR)' },
] as const;

export const DEFAULT_LOCALE = 'en-US';

/** Resolve the initial locale from localStorage or default */
function getInitialLocale(): string {
  try {
    const stored = localStorage.getItem('locale');
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      return stored;
    }
  } catch {
    // localStorage not available (SSR, tests)
  }
  return DEFAULT_LOCALE;
}

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { common: enUS },
    'tr-TR': { common: trTR },
  },
  lng: getInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  // Missing key handling: show fallback English, warn in dev
  saveMissing: false,
  missingKeyHandler: (_lngs, _ns, key) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Missing translation key: "${key}"`);
    }
  },
  parseMissingKeyHandler: (key) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Rendering missing key: "${key}"`);
    }
    return key;
  },
});

export default i18n;
