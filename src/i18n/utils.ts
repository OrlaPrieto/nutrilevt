import { ui, defaultLang } from './ui';

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export type uiKeys = keyof typeof ui[typeof defaultLang];

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: uiKeys): string {
    return (ui[lang] as any)[key] || (ui[defaultLang] as any)[key];
  }
}
