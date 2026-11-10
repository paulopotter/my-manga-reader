import { PreferencesManager } from '../../managers/preferences';

// HomeSettingsTool — what the user chose about which series the Home rails show. Persisted via
// PreferencesManager (one JSON entry); shared/ because the Home reads it and the Config screen
// writes it, and neither may import the other.
export interface HomeSettings {
  // "New in library" shows only series created within this many days.
  newInLibraryWindowDays: number;
  // "New in library" leaves out series that are followed or already being read.
  newInLibraryHideFollowedAndReading: boolean;
  // "Recently updated" leaves out series whose every page is read.
  recentlyUpdatedHideFullyRead: boolean;
  // "Followed series updated" counts only a chapter beyond the last one read (not an old one that
  // showed up in the middle).
  followedOnlyNewAtEnd: boolean;
}

export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  newInLibraryWindowDays: 7,
  newInLibraryHideFollowedAndReading: true,
  recentlyUpdatedHideFullyRead: true,
  followedOnlyNewAtEnd: true,
};

export const HOME_WINDOW_DAYS_OPTIONS = [3, 7, 14, 30] as const;

const DOMAIN = 'homeSettings';
const KEY = 'homeSettings';

// Each field is taken from the stored value only when it has the right type; anything else (a missing
// field from an older version, a wrong shape) falls back to its default, field by field.
function sanitize(raw: unknown): HomeSettings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Partial<Record<keyof HomeSettings, unknown>>) : {};
  const days = stored.newInLibraryWindowDays;
  return {
    newInLibraryWindowDays: typeof days === 'number' && days > 0 ? days : DEFAULT_HOME_SETTINGS.newInLibraryWindowDays,
    newInLibraryHideFollowedAndReading:
      typeof stored.newInLibraryHideFollowedAndReading === 'boolean'
        ? stored.newInLibraryHideFollowedAndReading
        : DEFAULT_HOME_SETTINGS.newInLibraryHideFollowedAndReading,
    recentlyUpdatedHideFullyRead:
      typeof stored.recentlyUpdatedHideFullyRead === 'boolean'
        ? stored.recentlyUpdatedHideFullyRead
        : DEFAULT_HOME_SETTINGS.recentlyUpdatedHideFullyRead,
    followedOnlyNewAtEnd:
      typeof stored.followedOnlyNewAtEnd === 'boolean' ? stored.followedOnlyNewAtEnd : DEFAULT_HOME_SETTINGS.followedOnlyNewAtEnd,
  };
}

export const HomeSettingsTool = {
  get(): Promise<HomeSettings> {
    // Started inside a promise so even a read that throws at once reads as "nothing stored".
    return Promise.resolve()
      .then(() => PreferencesManager.get({ key: KEY }))
      .then(entry => {
        if (!entry) {return DEFAULT_HOME_SETTINGS;}
        try {
          return sanitize(JSON.parse(entry.value));
        } catch {
          return DEFAULT_HOME_SETTINGS;
        }
      })
      .catch(() => DEFAULT_HOME_SETTINGS);
  },

  put({ settings }: { settings: HomeSettings }): Promise<void> {
    return PreferencesManager.put({ key: KEY, value: JSON.stringify(settings), domain: DOMAIN }).then(() => undefined);
  },

  same({ a, b }: { a: HomeSettings; b: HomeSettings }): boolean {
    return (
      a.newInLibraryWindowDays === b.newInLibraryWindowDays &&
      a.newInLibraryHideFollowedAndReading === b.newInLibraryHideFollowedAndReading &&
      a.recentlyUpdatedHideFullyRead === b.recentlyUpdatedHideFullyRead &&
      a.followedOnlyNewAtEnd === b.followedOnlyNewAtEnd
    );
  },
};
