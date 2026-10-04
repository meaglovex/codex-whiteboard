export type Theme = 'light' | 'dark';

/** A host theme takes precedence; ordinary browser tabs follow the OS immediately. */
export function observeTheme(root: HTMLElement, media: MediaQueryList) {
  let hostTheme: Theme | undefined;
  const apply = () => {
    const theme = hostTheme ?? (media.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.classList.toggle('dark', theme === 'dark');
  };
  media.addEventListener('change', apply);
  apply();
  return {
    setHostTheme(theme?: Theme) { hostTheme = theme; apply(); },
    dispose() { media.removeEventListener('change', apply); },
  };
}

const controller = typeof window === 'undefined' ? undefined : observeTheme(document.documentElement, window.matchMedia('(prefers-color-scheme: dark)'));
export const setHostTheme = (theme?: Theme) => controller?.setHostTheme(theme);
if (import.meta.hot) import.meta.hot.dispose(() => controller?.dispose());
