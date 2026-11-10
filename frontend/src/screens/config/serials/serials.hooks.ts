import { useCallback, useEffect, useState } from 'react';
import { ChaptersTool, DEFAULT_CHAPTER_DATE_STYLE, type ChapterSortMode } from '../../../shared/tools/chapters';
import type { DateStyle } from '../../../shared/tools/date';
import {
  DEFAULT_METADATA_SOURCE_PREFERENCES,
  MetadataSourcesTool,
  type DisputedMetadataField,
  type MetadataSource,
  type MetadataSourceChoice,
  type MetadataSourcePreferences,
} from '../../../shared/tools/metadata-sources';

// Mirrors ChaptersTool's own DEFAULT_SORT_PREFS — the percentage a series flips at when nothing
// has been chosen.
const DEFAULT_PROGRESS_PERCENT = 50;

// The global chapter-sort sub-screen's state, backed by ChaptersTool.sort (domain 'global').
// Contract unchanged — lifted out of ConfigScreen's ChapterSortSettingsScreen as-is.
export function useSerialsSort() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ChapterSortMode>('ASCENDING');
  const [fixedThreshold, setFixedThreshold] = useState<number | undefined>(undefined);
  const [progressPercent, setProgressPercent] = useState(DEFAULT_PROGRESS_PERCENT);

  useEffect(() => {
    ChaptersTool.sort
      .get({ domain: 'global' })
      .then(prefs => {
        setMode(prefs.mode);
        setFixedThreshold(prefs.fixedThreshold);
        // A preference stored before this field existed has no progressPercent; keeping the
        // initial value beats rendering "undefined%" in the label.
        setProgressPercent(prefs.progressPercent ?? DEFAULT_PROGRESS_PERCENT);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const change = useCallback(
    (nextMode: ChapterSortMode, nextThreshold: number | undefined, nextPercent: number) => {
      setMode(nextMode);
      setFixedThreshold(nextThreshold);
      setProgressPercent(nextPercent);
      ChaptersTool.sort
        .put({ domain: 'global' }, { mode: nextMode, fixedThreshold: nextThreshold, progressPercent: nextPercent })
        .catch(() => {});
    },
    [],
  );

  return { loading, mode, fixedThreshold, progressPercent, change };
}

// The metadata-source preferences, for the settings screen that edits them. Mirrors useSerialsSort
// above: load once, keep local state, write through on every change.
export function useMetadataSources() {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<MetadataSourcePreferences>(DEFAULT_METADATA_SOURCE_PREFERENCES);

  useEffect(() => {
    MetadataSourcesTool.preferences
      .get()
      .then(setPreferences)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Changing the global wipes every per-field choice — the user just answered for everything, so
  // previous exceptions no longer describe what they asked for. The tool owns that rule; this
  // only reflects whatever it returns.
  const changeGlobal = useCallback((source: MetadataSource) => {
    setPreferences(current => ({ ...current, global: source, fields: {} }));
    MetadataSourcesTool.preferences.putGlobal({ source }).then(setPreferences).catch(() => {});
  }, []);

  const changeField = useCallback(({ field, choice }: { field: DisputedMetadataField; choice: MetadataSourceChoice }) => {
    setPreferences(current => {
      const fields = { ...current.fields };
      if (choice === 'inherit') {
        delete fields[field];
      } else {
        fields[field] = choice;
      }
      return { ...current, fields };
    });
    MetadataSourcesTool.preferences.putField({ field, choice }).then(setPreferences).catch(() => {});
  }, []);

  return { loading, preferences, changeGlobal, changeField };
}

// The shape of the date beside each chapter on the serial page: load once, write through on change.
export function useChapterDateStyle() {
  const [style, setStyle] = useState<DateStyle>(DEFAULT_CHAPTER_DATE_STYLE);

  useEffect(() => {
    ChaptersTool.dateStyle.get().then(setStyle).catch(() => {});
  }, []);

  const change = useCallback((next: DateStyle) => {
    setStyle(next);
    ChaptersTool.dateStyle.put({ style: next }).catch(() => {});
  }, []);

  return { style, change };
}
