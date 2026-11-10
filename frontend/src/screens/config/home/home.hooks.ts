import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_HOME_SETTINGS, HomeSettingsTool, type HomeSettings } from '../../../shared/tools/home-settings';

// The Home settings sub-screen's state: load once, keep local state, write through on every change
// (same shape as the other config hooks). The Home itself re-reads them when it regains focus.
export function useHomeSettings() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<HomeSettings>(DEFAULT_HOME_SETTINGS);

  useEffect(() => {
    HomeSettingsTool.get()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const change = useCallback((patch: Partial<HomeSettings>) => {
    setSettings(current => {
      const next = { ...current, ...patch };
      HomeSettingsTool.put({ settings: next }).catch(() => {});
      return next;
    });
  }, []);

  return { loading, settings, change };
}
