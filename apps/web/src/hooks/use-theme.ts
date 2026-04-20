import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { settingsQueryOptions } from '../lib/api';

/**
 * Reads `settings.theme` from the query cache and applies the
 * appropriate class to <html>.  When theme is 'system' it follows
 * the OS preference via matchMedia and re-runs whenever it changes.
 */
export function useTheme() {
  const { data: settings } = useQuery(settingsQueryOptions);
  const theme = settings?.theme ?? 'system';

  useEffect(() => {
    const root = document.documentElement;

    if (theme !== 'system') {
      // Explicit light/dark — set once, no listener needed.
      root.classList.toggle('dark', theme === 'dark');
      return undefined;
    }

    // System preference — follow OS via matchMedia.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.classList.toggle('dark', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
    };
  }, [theme]);
}
