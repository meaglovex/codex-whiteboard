import { useMemo, useSyncExternalStore } from 'react';
import { resolveLocale, translate, translateError, formatDateTime } from '../shared/i18n.mjs';

let hostLocale: string | undefined;
const listeners = new Set<() => void>();
const browserLanguages = () => typeof navigator === 'undefined' ? ['en'] : navigator.languages?.length ? navigator.languages : [navigator.language];
function makeSnapshot() {
  const preferences = hostLocale ? [hostLocale, ...browserLanguages()] : browserLanguages();
  return { locale: resolveLocale(preferences), dateLocale: preferences[0] || 'en' };
}
let snapshot = makeSnapshot();
function refresh() {
  const next = makeSnapshot();
  if (typeof document !== 'undefined') document.documentElement.lang = next.locale;
  if (snapshot.locale === next.locale && snapshot.dateLocale === next.dateLocale) return;
  snapshot = next; listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
export function setHostLocale(locale?: string) { hostLocale = locale; refresh(); }
if (typeof window !== 'undefined') {
  refresh(); window.addEventListener('languagechange', refresh);
  if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('languagechange', refresh));
}
export function useI18n() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => ({
    ...value,
    t: (key: string, params?: Record<string, string | number>) => translate(value.locale, key, params),
    errorText: (message: string) => translateError(value.locale, message),
    formatDate: (date: string | number | Date, options?: Intl.DateTimeFormatOptions) => formatDateTime(value.dateLocale, date, options),
  }), [value]);
}
