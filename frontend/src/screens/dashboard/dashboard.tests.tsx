import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../../shared/i18n', () => ({
  useStrings: () => require('../../shared/i18n/strings').getStrings('en'),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

let mockState: Record<string, unknown>;
let mockHide: jest.Mock;
jest.mock('./hooks', () => ({ useDashboard: () => mockState }));

import { Routes } from '../../navigation/routes';
import { DashboardScreen } from './dashboard.screen';
import { ThemeProvider } from '../../shared/context';

jest.mock('../../shared/managers/preferences', () => ({
  PreferencesManager: { get: jest.fn().mockResolvedValue(null), put: jest.fn().mockResolvedValue({}) },
}));

const data = {
  continueReading: [{ seriesId: 's1', chapterId: 'c1', name: 'Reading', coverUrl: 'c', caption: 'Ch. 1' }],
  followedUpdated: [],
  recentlyUpdated: [{ seriesId: 's2', name: 'Fresh', coverUrl: 'c' }],
  unfinished: [],
  recentlyAdded: [],
  stats: { series: 9, followed: 2, inProgress: 1 },
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <DashboardScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHide = jest.fn().mockResolvedValue(undefined);
  mockState = { status: 'ready', data, refreshing: false, refresh: jest.fn(), retry: jest.fn(), hideContinue: mockHide };
});

describe('DashboardScreen', () => {
  it('opens the reader on the chapter of a continue-reading tile', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Reading'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.READER, { seriesId: 's1', chapterId: 'c1', origin: 'DASHBOARD' });
  });

  it('opens the series from any other tile', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Fresh'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.SERIES_DETAIL, { seriesId: 's2', origin: 'DASHBOARD' });
  });

  describe('hiding a series from "continue reading"', () => {
    it('asks first, naming the series, when a continue-reading tile is held', async () => {
      const { findByText, getByText, queryByText } = renderScreen();
      expect(queryByText(/Hide “Reading”/)).toBeNull();
      fireEvent(await findByText('Reading'), 'longPress');
      expect(getByText(/Hide “Reading” from Continue reading\?/)).toBeTruthy();
      expect(mockHide).not.toHaveBeenCalled();
    });

    it('hides the series on confirm, and does not open it', async () => {
      const { findByText, getByText } = renderScreen();
      fireEvent(await findByText('Reading'), 'longPress');
      fireEvent.press(getByText('Hide'));
      expect(mockHide).toHaveBeenCalledWith({ seriesId: 's1' });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps the series when the ask is cancelled', async () => {
      const { findByText, getByText, queryByText } = renderScreen();
      fireEvent(await findByText('Reading'), 'longPress');
      fireEvent.press(getByText('Cancel'));
      expect(mockHide).not.toHaveBeenCalled();
      expect(queryByText(/Hide “Reading”/)).toBeNull();
    });

    it('does nothing when another rail tile is held', async () => {
      const { findByText, queryByText } = renderScreen();
      fireEvent(await findByText('Fresh'), 'longPress');
      expect(queryByText(/from Continue reading/)).toBeNull();
    });
  });

  it('draws the rails that have something and hides the ones with nothing', async () => {
    const { findByText, queryByText } = renderScreen();
    expect(await findByText('Continue reading')).toBeTruthy();
    expect(await findByText('Recently updated')).toBeTruthy();
    // Followed-updated, not-finished and new-in-library have no tiles: no title either.
    expect(queryByText('Followed series updated')).toBeNull();
    expect(queryByText('Not finished yet…')).toBeNull();
    expect(queryByText('New in library')).toBeNull();
  });

  it('puts the rails in order: continue, followed updated, not finished, recently updated', async () => {
    mockState = {
      ...mockState,
      data: {
        ...data,
        followedUpdated: [{ seriesId: 'f', name: 'F', coverUrl: 'c' }],
        unfinished: [{ seriesId: 'u', name: 'U', coverUrl: 'c' }],
      },
    };
    const { findByText, UNSAFE_getAllByType } = renderScreen();
    await findByText('Continue reading');
    const { Text } = require('react-native');
    const titles = UNSAFE_getAllByType(Text).map((node: { props: { children?: unknown } }) => String(node.props.children));
    const at = (title: string) => titles.indexOf(title);
    expect(at('Continue reading')).toBeLessThan(at('Followed series updated'));
    expect(at('Followed series updated')).toBeLessThan(at('Not finished yet…'));
    expect(at('Not finished yet…')).toBeLessThan(at('Recently updated'));
  });

  it('shows a spinner while loading', async () => {
    mockState = { ...mockState, status: 'loading', data: null };
    const { queryByText } = renderScreen();
    expect(queryByText('Continue reading')).toBeNull();
  });

  it('shows the error with a retry', async () => {
    mockState = { ...mockState, status: 'error', data: null };
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Try again'));
    expect(mockState.retry).toHaveBeenCalled();
  });
});
