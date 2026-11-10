import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';

const mockSetLanguage = jest.fn();
let mockLanguage = 'en';
jest.mock('../../shared/i18n/i18n.hooks', () => ({
  useStrings: () => require('../../shared/i18n/strings').getStrings('en'),
  useLanguage: () => ({ language: mockLanguage, setLanguage: mockSetLanguage }),
}));

// Each sub-screen is tested in its own folder — stub them here so this file only asserts the
// router + menu wiring.
const stub = (label: string) => (props: { onBack?: () => void }) => {
  const { Text } = require('react-native');
  return (
    <Text testID={`stub-${label}`} onPress={props.onBack}>
      {label}
    </Text>
  );
};
// The real ThemeProvider reads the stored choice through :preferences; the picker tests below
// render inside it, so the store needs a stand-in.
jest.mock('../../shared/managers/preferences', () => ({
  PreferencesManager: { get: jest.fn().mockResolvedValue(null), put: jest.fn().mockResolvedValue({}) },
}));
jest.mock('./server', () => ({ ServerScreen: (p: { onBack?: () => void }) => stub('server')(p) }));
jest.mock('./reader', () => ({ ReaderPrefsScreen: (p: { onBack?: () => void }) => stub('reader')(p) }));
jest.mock('./serials', () => ({ SerialsSortScreen: (p: { onBack?: () => void }) => stub('serials')(p) }));
jest.mock('./home', () => ({ HomeSettingsScreen: (p: { onBack?: () => void }) => stub('home')(p) }));
jest.mock('./adult', () => ({ AdultFilterScreen: (p: { onBack?: () => void }) => stub('adult')(p) }));
jest.mock('./debug', () => ({ DebugScreen: (p: { onBack?: () => void }) => stub('debug')(p) }));

// AppVersions owns the debug-unlock tap gesture; stub it with a button that fires onDebugUnlocked.
jest.mock('../../shared/components/app-versions', () => ({
  AppVersions: (p: { onDebugUnlocked?: () => void }) => {
    const { Text } = require('react-native');
    return <Text testID="unlock-debug" onPress={p.onDebugUnlocked}>versions</Text>;
  },
}));

import { getStrings } from '../../shared/i18n/strings';
import { ThemeProvider } from '../../shared/context';
import { useConfigLanguage, useConfigMenu, useConfigStartScreen } from './config.hooks';
import { CONFIG_RESET_DELAY_MS, ConfigScreen } from './config.screen';

const t = getStrings('en');

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
});

describe('useConfigStartScreen', () => {
  it('reads the stored choice and persists a change', async () => {
    const { PreferencesManager } = require('../../shared/managers/preferences');
    PreferencesManager.get.mockResolvedValueOnce({ value: 'following' });
    const { result } = renderHook(() => useConfigStartScreen());
    await waitFor(() => expect(result.current.startScreen).toBe('following'));
    act(() => result.current.changeStartScreen('dashboard'));
    expect(result.current.startScreen).toBe('dashboard');
    expect(PreferencesManager.put).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'startScreen', value: 'dashboard' }),
    );
  });
});

describe('useConfigLanguage', () => {
  it('exposes the shared language + a changeLanguage that delegates to setLanguage', () => {
    const { result } = renderHook(() => useConfigLanguage());
    expect(result.current.language).toBe('en');
    result.current.changeLanguage('pt-BR');
    expect(mockSetLanguage).toHaveBeenCalledWith('pt-BR');
  });
});

describe('useConfigMenu', () => {
  it('starts locked and unlockDebug flips it', () => {
    const { result } = renderHook(() => useConfigMenu());
    expect(result.current.debugUnlocked).toBe(false);
    act(() => result.current.unlockDebug());
    expect(result.current.debugUnlocked).toBe(true);
  });
});

describe('ConfigScreen router', () => {
  it('shows the menu with the three always-on rows', () => {
    const { getByText, queryByText } = render(<ConfigScreen />);
    expect(getByText(t.configTitle)).toBeTruthy();
    expect(getByText(t.configMenuServer)).toBeTruthy();
    expect(getByText(t.configMenuReading)).toBeTruthy();
    expect(getByText(t.configMenuSerials)).toBeTruthy();
    expect(queryByText('Debug')).toBeNull(); // locked by default
  });

  it('navigates into a sub-screen and the back handler returns to the menu', () => {
    const onRegisterBackHandler = jest.fn();
    const { getByText, getByTestId, queryByText } = render(
      <ConfigScreen onRegisterBackHandler={onRegisterBackHandler} />,
    );
    fireEvent.press(getByText(t.configMenuServer));
    expect(getByTestId('stub-server')).toBeTruthy();
    // entering a sub-screen registers a back handler
    expect(onRegisterBackHandler).toHaveBeenLastCalledWith(expect.any(Function));

    fireEvent.press(getByTestId('stub-server')); // stub calls onBack on press
    expect(queryByText(t.configTitle)).toBeTruthy(); // back on the menu
  });

  it('opens the Home settings from its menu row', () => {
    const { getByText, getByTestId } = render(<ConfigScreen />);
    fireEvent.press(getByText(t.configMenuHome));
    expect(getByTestId('stub-home')).toBeTruthy();
  });

  it('opens the adult-content filter from its menu row', () => {
    const { getByText, getByTestId } = render(<ConfigScreen />);
    fireEvent.press(getByText(t.configMenuAdult));
    expect(getByTestId('stub-adult')).toBeTruthy();
  });

  it('reveals the Debug row only after the version footer unlocks it', () => {
    const { getByTestId, getByText, queryByText } = render(<ConfigScreen />);
    expect(queryByText('Debug')).toBeNull();
    fireEvent.press(getByTestId('unlock-debug'));
    expect(getByText('Debug')).toBeTruthy();
  });

  it('the hardware back press pops a sub-screen back to the menu', () => {
    let hwHandler: (() => boolean) | undefined;
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_evt, handler) => {
        hwHandler = handler as () => boolean;
        return { remove: jest.fn() };
      });

    const { getByText, queryByText } = render(<ConfigScreen />);
    fireEvent.press(getByText(t.configMenuReading));
    expect(queryByText(t.configTitle)).toBeNull();

    act(() => {
      hwHandler?.();
    });
    expect(queryByText(t.configTitle)).toBeTruthy();
    spy.mockRestore();
  });
});

describe('ConfigScreen reset after leaving', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const openReading = (focused: boolean) => {
    const utils = render(<ConfigScreen focused={focused} />);
    fireEvent.press(utils.getByText(t.configMenuReading));
    return utils;
  };

  it('returns to the menu once the tab stays off screen for the delay', () => {
    const { rerender, getByTestId, queryByText } = openReading(true);
    rerender(<ConfigScreen focused={false} />);
    act(() => {
      jest.advanceTimersByTime(CONFIG_RESET_DELAY_MS);
    });
    rerender(<ConfigScreen focused />);
    expect(queryByText(t.configTitle)).toBeTruthy();
    expect(() => getByTestId('stub-reader')).toThrow();
  });

  it('keeps the sub-level when it comes back before the delay', () => {
    const { rerender, getByTestId } = openReading(true);
    rerender(<ConfigScreen focused={false} />);
    act(() => {
      jest.advanceTimersByTime(CONFIG_RESET_DELAY_MS - 1);
    });
    rerender(<ConfigScreen focused />);
    act(() => {
      jest.advanceTimersByTime(CONFIG_RESET_DELAY_MS * 2);
    });
    expect(getByTestId('stub-reader')).toBeTruthy();
  });

  it('stays on the menu without arming anything when already there', () => {
    const { rerender, queryByText } = render(<ConfigScreen focused />);
    rerender(<ConfigScreen focused={false} />);
    act(() => {
      jest.advanceTimersByTime(CONFIG_RESET_DELAY_MS);
    });
    expect(queryByText(t.configTitle)).toBeTruthy();
  });
});

describe('theme picker', () => {
  // These render inside the real provider: without it useTheme() falls back to the default
  // context, whose setTheme is a no-op, and the switch would silently do nothing.
  const renderThemed = () =>
    render(
      <ThemeProvider>
        <ConfigScreen />
      </ThemeProvider>,
    );

  // Teal holds the default role, and the picker marks it rather than the name carrying it.
  const defaultLabel = `${t.themeNameTeal} - ${t.themeDefaultSuffix}`;

  it('shows the active theme in the select', () => {
    const { getByText } = renderThemed();
    expect(getByText(t.configMenuTheme)).toBeTruthy();
    // The default identity is what a fresh install wears.
    expect(getByText(defaultLabel)).toBeTruthy();
  });

  it('marks the default identity, instead of naming a theme "default"', () => {
    const { getByText } = renderThemed();
    expect(getByText(defaultLabel)).toBeTruthy();
  });

  // Onyx has no lighter twin, but its floor is real black like any variant's — the suffix says
  // what the palette IS, not that it has a parent.
  it('marks onyx as OLED even though it has no lighter twin', () => {
    const { getByText } = renderThemed();
    fireEvent.press(getByText(defaultLabel));
    expect(getByText(`${t.themeNameOnyx} - ${t.themeOledSuffix}`)).toBeTruthy();
  });

  it('composes a variant’s label from its parent, rather than duplicating the name', () => {
    const { getByText } = renderThemed();
    fireEvent.press(getByText(defaultLabel));
    expect(getByText(`${t.themeNameWine} - ${t.themeOledSuffix}`)).toBeTruthy();
  });

  it('lists every registered theme when opened', () => {
    const { getByText } = renderThemed();
    fireEvent.press(getByText(defaultLabel));
    expect(getByText(t.themeNameCrimson)).toBeTruthy();
  });

  it('repaints when another theme is chosen', () => {
    const { getByText, queryByText } = renderThemed();
    fireEvent.press(getByText(defaultLabel));
    fireEvent.press(getByText(t.themeNameCrimson));
    // The trigger now carries the new identity, which only happens if the screen re-rendered
    // against the new palette.
    expect(queryByText(t.themeNameCrimson)).toBeTruthy();
  });
});
