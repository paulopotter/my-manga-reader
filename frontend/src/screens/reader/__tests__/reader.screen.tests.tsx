import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { LoadedChapterEntry, ReaderChapter } from '../reader.types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: { seriesId: 's1', chapterId: 'c1', origin: 'LIBRARY' } }),
}));

const mockRealize = jest.fn(() => jest.fn());

jest.mock('../../../shared/tools/actions', () => ({ useAction: () => ({ realize: mockRealize }) }));

const mockOnScreenExit = jest.fn().mockResolvedValue(undefined);
const mockToggleOverlay = jest.fn();
const mockScrollToPage = jest.fn();
const mockOnNativePosition = jest.fn();
const mockHandleScrollRequestHandled = jest.fn();
const mockLoadChapter = jest.fn();
const mockGoToAdjacent = jest.fn();
const mockGoToChapter = jest.fn();

let mockReaderState: any;

jest.mock('../hooks/reader.hooks', () => ({ useReader: () => mockReaderState }));

// ReaderSettingsModal (rendered by the screen, always mounted so its own Modal visibility can
// toggle) reuses Ajustes > Reading's own hook verbatim — mocked here so this suite doesn't also
// have to stub the native PreferencesManager bridge just to render the screen.
jest.mock('../../config/reader/reader.hooks', () => ({
  useReaderPrefs: () => ({
    prefs: { keepScreenOnDuringReading: false, immersiveModeDuringReading: false, progressBarPosition: undefined },
    update: jest.fn(),
  }),
}));

// The screen reads the progress-bar edge directly (not through useReaderPrefs) to hand it to
// ThinProgressBar — mocked the same way, for the same reason (no native bridge in tests).
const mockGetProgressBarPosition = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../shared/tools/reader', () => ({
  ReaderPrefs: { getProgressBarPosition: () => mockGetProgressBarPosition() },
}));

import { ReaderScreen } from '../reader.screen';

function makeChapter(over: Partial<ReaderChapter> = {}): ReaderChapter {
  return {
    id: 'c1',
    seriesId: 's1',
    number: 1,
    title: 'A Chegada',
    readStatus: 'UNREAD',
    pageCount: 2,
    pagesRead: 0,
    pageUrls: ['url0', 'url1'],
    pageAspectRatios: [1.5, 1.5],
    serverResume: null,
    ...over,
  };
}

function entry(over: Partial<ReaderChapter> = {}, status: LoadedChapterEntry['status'] = 'ready'): LoadedChapterEntry {
  return { chapter: makeChapter(over), status };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReaderState = {
    backAction: { navigate: { back: { route: 'series/:seriesId', params: { seriesId: 's1' }, canUseGoBack: true } } },
    loading: true,
    error: null,
    window: null,
    seriesName: 'Série',
    overlayVisible: false,
    currentVisiblePage: 0,
    scrollFraction: 0,
    chapterFraction: 0,
    offline: false,
    scrollRequest: null,
    readingMode: 'webtoon',
    order: [],
    hasPrevChapter: true,
    hasNextChapter: true,
    onScreenExit: mockOnScreenExit,
    toggleOverlay: mockToggleOverlay,
    scrollToPage: mockScrollToPage,
    onNativePosition: mockOnNativePosition,
    handleScrollRequestHandled: mockHandleScrollRequestHandled,
    loadChapter: mockLoadChapter,
    goToAdjacent: mockGoToAdjacent,
    goToChapter: mockGoToChapter,
  };
});

function withWindow(entries: LoadedChapterEntry[], focusedIndex = 0) {
  mockReaderState = { ...mockReaderState, loading: false, window: { entries, focusedIndex } };
}

describe('ReaderScreen V2 — loading / error', () => {
  it('shows the loading label while there is no window', () => {
    const { getByText } = render(<ReaderScreen />);
    expect(getByText('Carregando...')).toBeTruthy();
  });

  it('shows the error state (message + retry) instead of a black screen', () => {
    mockReaderState = { ...mockReaderState, loading: false, error: 'Chapter not found' };
    const { getByText } = render(<ReaderScreen />);
    expect(getByText('Erro ao carregar o capítulo')).toBeTruthy();
    expect(getByText('Tentar novamente')).toBeTruthy();
  });

  it('retry calls loadChapter with the route chapterId', () => {
    mockReaderState = { ...mockReaderState, loading: false, error: 'boom' };
    const { getByText } = render(<ReaderScreen />);
    fireEvent.press(getByText('Tentar novamente'));
    expect(mockLoadChapter).toHaveBeenCalledWith('c1');
  });

  it('offers "Voltar" on the error state and realizes the hook\'s backAction', () => {
    mockReaderState = { ...mockReaderState, loading: false, error: 'boom' };
    const { getByText } = render(<ReaderScreen />);
    fireEvent.press(getByText('Voltar'));
    expect(mockRealize).toHaveBeenCalledWith(mockReaderState.backAction);
  });

  it('fires onScreenExit on unmount', () => {
    const { unmount } = render(<ReaderScreen />);
    unmount();
    expect(mockOnScreenExit).toHaveBeenCalledTimes(1);
  });
});

describe('ReaderScreen V2 — blocks & forwarding', () => {
  it('renders one native block per window entry', () => {
    withWindow([entry({ id: 'c1' }), entry({ id: 'c2' }, 'placeholder')], 0);
    const { getByTestId } = render(<ReaderScreen />);
    const blocks = getByTestId('reader-page-list-view').props.blocks;
    expect(blocks.map((b: { chapterId: string }) => b.chapterId)).toEqual(['c1', 'c2']);
  });

  it('maps null aspect ratios to 0 for the native side', () => {
    withWindow([entry({ pageAspectRatios: [1.5, null] as (number | null)[] })], 0);
    const { getByTestId } = render(<ReaderScreen />);
    expect(getByTestId('reader-page-list-view').props.blocks[0].pageAspectRatios).toEqual([1.5, 0]);
  });

  it('forwards the native position payload verbatim to the hook (no decision in the screen)', () => {
    withWindow([entry()], 0);
    const { getByTestId } = render(<ReaderScreen />);
    act(() => {
      getByTestId('reader-page-list-view').props.onVisiblePageChanged({
        nativeEvent: { chapterId: 'c9', pageIndex: 1, pageFraction: 0.4, chapterFraction: 0.1 },
      });
    });
    expect(mockOnNativePosition).toHaveBeenCalledWith('c9', 1, 0.4, 0.1);
  });

  it('reflects a pending scroll request', () => {
    withWindow([entry({ pageUrls: ['u0', 'u1', 'u2'] })], 0);
    mockReaderState.scrollRequest = { chapterId: 'c1', page: 2 };
    const { getByTestId } = render(<ReaderScreen />);
    const list = getByTestId('reader-page-list-view');
    expect(list.props.scrollToChapterId).toBe('c1');
    expect(list.props.scrollToPageIndex).toBe(2);
  });

  it('scrollToChapterId is null with no pending request', () => {
    withWindow([entry()], 0);
    const { getByTestId } = render(<ReaderScreen />);
    expect(getByTestId('reader-page-list-view').props.scrollToChapterId).toBeNull();
  });
});

describe('ReaderScreen V2 — overlay wiring', () => {
  it('arrows call goToAdjacent with the right direction', () => {
    withWindow([entry({ id: 'c1' }), entry({ id: 'c2' }), entry({ id: 'c3' })], 1);
    mockReaderState.overlayVisible = true;
    const { getByLabelText } = render(<ReaderScreen />);
    fireEvent.press(getByLabelText('Capítulo anterior'));
    fireEvent.press(getByLabelText('Próximo capítulo'));
    expect(mockGoToAdjacent).toHaveBeenNthCalledWith(1, 'prev');
    expect(mockGoToAdjacent).toHaveBeenNthCalledWith(2, 'next');
  });

  it('the arrows are enabled/disabled from hasPrevChapter / hasNextChapter (series-order based)', () => {
    withWindow([entry({ id: 'c1' })], 0);
    mockReaderState.overlayVisible = true;
    mockReaderState.hasPrevChapter = false; // c1 is the first chapter of the series
    mockReaderState.hasNextChapter = true;
    const { getByLabelText } = render(<ReaderScreen />);
    fireEvent.press(getByLabelText('Capítulo anterior'));
    expect(mockGoToAdjacent).not.toHaveBeenCalled(); // disabled
    fireEvent.press(getByLabelText('Próximo capítulo'));
    expect(mockGoToAdjacent).toHaveBeenCalledWith('next');
  });

  it('shows the offline banner when offline', () => {
    withWindow([entry()], 0);
    mockReaderState.offline = true;
    const { getByText } = render(<ReaderScreen />);
    expect(getByText('Sem conexão')).toBeTruthy();
  });
});

describe('ReaderScreen V2 — placeholder focus', () => {
  it('shows a spinner over the reading area when the focused chapter has no pages yet', () => {
    withWindow([entry({ id: 'c1' }, 'placeholder')], 0);
    const { UNSAFE_getAllByType } = render(<ReaderScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('does NOT show the page-loading spinner when the focused chapter is ready', () => {
    withWindow([entry({ id: 'c1' }, 'ready')], 0);
    const { UNSAFE_queryAllByType } = render(<ReaderScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(0);
  });
});

describe('ReaderScreen V2 — back button', () => {
  it('realizes the hook\'s own backAction (its series, real history or not) instead of a plain goBack', () => {
    withWindow([entry()], 0);
    mockReaderState.overlayVisible = true; // the top bar (with the back button) is only visible when the overlay is
    const { UNSAFE_getAllByType } = render(<ReaderScreen />);
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockRealize).toHaveBeenCalledWith(mockReaderState.backAction);
  });
});

describe('ReaderScreen V2 — page indicator', () => {
  it('shows "current de total" (1-indexed) for a multi-page chapter', () => {
    withWindow([entry({ id: 'c1', pageUrls: ['u0', 'u1', 'u2'] })], 0);
    mockReaderState.overlayVisible = true;
    mockReaderState.currentVisiblePage = 1;
    const { getByText } = render(<ReaderScreen />);
    expect(getByText('2 de 3')).toBeTruthy();
  });

  it('shows no page indicator for a single-page chapter', () => {
    withWindow([entry({ id: 'c1', pageUrls: ['u0'] })], 0);
    mockReaderState.overlayVisible = true;
    const { queryByText } = render(<ReaderScreen />);
    expect(queryByText(/^\d+ de \d+$/)).toBeNull();
  });
});

describe('ReaderScreen V2 — progress bar position', () => {
  it('defaults to the vertical/right bar when nothing is stored', async () => {
    mockGetProgressBarPosition.mockResolvedValue(undefined);
    withWindow([entry()], 0);
    const { findByTestId } = render(<ReaderScreen />);
    const fill = await findByTestId('thin-progress-fill');
    expect(fill.props.style[1].height).toBeDefined();
    expect(fill.props.style[1].width).toBeUndefined();
  });

  it('passes a stored edge through to ThinProgressBar', async () => {
    mockGetProgressBarPosition.mockResolvedValue('top');
    withWindow([entry()], 0);
    const { findByTestId } = render(<ReaderScreen />);
    const fill = await findByTestId('thin-progress-fill');
    expect(fill.props.style[1].width).toBeDefined();
    expect(fill.props.style[1].height).toBeUndefined();
  });
});

describe('ReaderScreen V2 — footer quick actions', () => {
  it('opens the chapter picker from the footer and jumps via goToChapter on selection', () => {
    withWindow(
      [entry({ id: 'c1', number: 1, title: 'Sem título' }), entry({ id: 'c2', number: 2, title: 'Sem título' })],
      0,
    );
    mockReaderState.overlayVisible = true;
    mockReaderState.order = [
      { id: 'c1', seriesId: 's1', number: 1, title: 'Sem título', readStatus: 'UNREAD' },
      { id: 'c2', seriesId: 's1', number: 2, title: 'Sem título', readStatus: 'UNREAD' },
    ];
    const { getByText } = render(<ReaderScreen />);

    fireEvent.press(getByText('Selecionar capítulo'));
    expect(getByText('Capítulos')).toBeTruthy(); // the picker sheet opened

    fireEvent.press(getByText('2. Sem título'));
    expect(mockGoToChapter).toHaveBeenCalledWith('c2');
  });

  it('opens the settings modal from the footer', () => {
    withWindow([entry()], 0);
    mockReaderState.overlayVisible = true;
    const { getByText, getAllByText } = render(<ReaderScreen />);
    fireEvent.press(getByText('Ajustes de leitura'));
    // The modal's own title repeats the button's label — asserting there are now two confirms
    // it actually opened (the footer button is still on screen too).
    expect(getAllByText('Ajustes de leitura').length).toBe(2);
  });
});
