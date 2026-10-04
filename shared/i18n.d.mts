export type Locale = 'zh-CN' | 'zh-TW' | 'en';
export const messages: Record<string, [string, string, string]>;
export const supportedLocales: Locale[];
export function resolveLocale(preferences?: string | readonly string[]): Locale;
export function translate(locale: string, key: string, params?: Record<string,string|number>): string;
export function formatDateTime(locale: string, value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
export function translateError(locale: string, message: string): string;
