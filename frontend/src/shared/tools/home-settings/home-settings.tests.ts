import { DEFAULT_HOME_SETTINGS, HomeSettingsTool } from './home-settings.tool';

jest.mock('../../managers/preferences', () => ({
  PreferencesManager: { get: jest.fn(), put: jest.fn() },
}));
import { PreferencesManager } from '../../managers/preferences';

const mockGet = PreferencesManager.get as jest.Mock;
const mockPut = PreferencesManager.put as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset().mockResolvedValue(undefined);
});

describe('HomeSettingsTool.get', () => {
  it('returns the defaults when nothing is stored', async () => {
    mockGet.mockResolvedValue(null);
    await expect(HomeSettingsTool.get()).resolves.toEqual(DEFAULT_HOME_SETTINGS);
  });

  it('returns what was stored', async () => {
    const stored = { newInLibraryWindowDays: 14, newInLibraryHideFollowedAndReading: false, recentlyUpdatedHideFullyRead: false, followedOnlyNewAtEnd: false };
    mockGet.mockResolvedValue({ value: JSON.stringify(stored) });
    await expect(HomeSettingsTool.get()).resolves.toEqual(stored);
  });

  it('falls back field by field when a stored field is missing or has the wrong type', async () => {
    mockGet.mockResolvedValue({ value: JSON.stringify({ newInLibraryWindowDays: 'x', followedOnlyNewAtEnd: false }) });
    await expect(HomeSettingsTool.get()).resolves.toEqual({ ...DEFAULT_HOME_SETTINGS, followedOnlyNewAtEnd: false });
  });

  it('falls back to the defaults for malformed JSON, a non-object value or a failing read', async () => {
    mockGet.mockResolvedValueOnce({ value: '{nope' });
    await expect(HomeSettingsTool.get()).resolves.toEqual(DEFAULT_HOME_SETTINGS);
    mockGet.mockResolvedValueOnce({ value: '42' });
    await expect(HomeSettingsTool.get()).resolves.toEqual(DEFAULT_HOME_SETTINGS);
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await expect(HomeSettingsTool.get()).resolves.toEqual(DEFAULT_HOME_SETTINGS);
  });
});

describe('HomeSettingsTool.put / same', () => {
  it('writes one JSON entry under its own domain', async () => {
    await HomeSettingsTool.put({ settings: DEFAULT_HOME_SETTINGS });
    expect(mockPut).toHaveBeenCalledWith({ key: 'homeSettings', value: JSON.stringify(DEFAULT_HOME_SETTINGS), domain: 'homeSettings' });
  });

  it('same compares every field', () => {
    expect(HomeSettingsTool.same({ a: DEFAULT_HOME_SETTINGS, b: { ...DEFAULT_HOME_SETTINGS } })).toBe(true);
    expect(HomeSettingsTool.same({ a: DEFAULT_HOME_SETTINGS, b: { ...DEFAULT_HOME_SETTINGS, newInLibraryWindowDays: 3 } })).toBe(false);
    expect(HomeSettingsTool.same({ a: DEFAULT_HOME_SETTINGS, b: { ...DEFAULT_HOME_SETTINGS, followedOnlyNewAtEnd: false } })).toBe(false);
  });
});
