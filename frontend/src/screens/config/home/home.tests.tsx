import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { findPressableAncestor } from '../../../shared/test-utils/find-pressable-ancestor';

jest.mock('../../../shared/i18n/i18n.hooks', () => ({
  useStrings: () => require('../../../shared/i18n/strings').getStrings('en'),
}));

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock('../../../shared/tools/home-settings', () => ({
  ...jest.requireActual('../../../shared/tools/home-settings'),
  HomeSettingsTool: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

jest.mock('../../../shared/managers/preferences', () => ({
  PreferencesManager: { get: jest.fn().mockResolvedValue(null), put: jest.fn().mockResolvedValue({}) },
}));

import { getStrings } from '../../../shared/i18n/strings';
import { DEFAULT_HOME_SETTINGS } from '../../../shared/tools/home-settings';
import { ThemeProvider } from '../../../shared/context';
import { useHomeSettings } from './home.hooks';
import { HomeSettingsScreen } from './home.screen';

const t = getStrings('en');

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(DEFAULT_HOME_SETTINGS);
  mockPut.mockResolvedValue(undefined);
});

describe('useHomeSettings', () => {
  it('loads the stored settings', async () => {
    mockGet.mockResolvedValue({ ...DEFAULT_HOME_SETTINGS, newInLibraryWindowDays: 14 });
    const { result } = renderHook(() => useHomeSettings());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.newInLibraryWindowDays).toBe(14);
  });

  it('keeps the defaults when the read fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useHomeSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toEqual(DEFAULT_HOME_SETTINGS);
  });

  it('writes the merged settings through on a change', async () => {
    const { result } = renderHook(() => useHomeSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.change({ followedOnlyNewAtEnd: false }));
    expect(result.current.settings.followedOnlyNewAtEnd).toBe(false);
    expect(mockPut).toHaveBeenCalledWith({ settings: { ...DEFAULT_HOME_SETTINGS, followedOnlyNewAtEnd: false } });
  });
});

describe('HomeSettingsScreen', () => {
  const renderScreen = (onBack = jest.fn()) =>
    render(
      <ThemeProvider>
        <HomeSettingsScreen onBack={onBack} />
      </ThemeProvider>,
    );

  it('shows the three sections once loaded, with the current window', async () => {
    const { findByText } = renderScreen();
    expect(await findByText(t.configHomeNewTitle)).toBeTruthy();
    expect(await findByText(t.configHomeUpdatedTitle)).toBeTruthy();
    expect(await findByText(t.configHomeFollowedTitle)).toBeTruthy();
    expect(await findByText(t.configHomeWindowDays.replace('{0}', '7'))).toBeTruthy();
  });

  it('flips a toggle by pressing its row and saves it', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText(t.configHomeUpdatedHideFullyRead));
    expect(mockPut).toHaveBeenCalledWith({ settings: { ...DEFAULT_HOME_SETTINGS, recentlyUpdatedHideFullyRead: false } });
  });

  it('changes the window from the select', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText(t.configHomeWindowDays.replace('{0}', '7')));
    fireEvent.press(await findByText(t.configHomeWindowDays.replace('{0}', '30')));
    expect(mockPut).toHaveBeenCalledWith({ settings: { ...DEFAULT_HOME_SETTINGS, newInLibraryWindowDays: 30 } });
  });

  it('the back chevron calls onBack', async () => {
    const onBack = jest.fn();
    const { findByText, UNSAFE_getByType } = renderScreen(onBack);
    await findByText(t.configHomeNewTitle);
    fireEvent.press(findPressableAncestor(UNSAFE_getByType(ChevronLeft), TouchableOpacity) as never);
    expect(onBack).toHaveBeenCalled();
  });
});
