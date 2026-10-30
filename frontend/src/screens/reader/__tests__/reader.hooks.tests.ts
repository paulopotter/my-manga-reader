import { act, renderHook, waitFor } from '@testing-library/react-native';

// ── mocks ───────────────────────────────────────────────────────────────

const mockGetFull = jest.fn();
const mockProgressSet = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../shared/services/chapters', () => ({
  ChapterService: {
    getFull: (...a: unknown[]) => mockGetFull(...a),
    progress: { set: (...a: unknown[]) => mockProgressSet(...a) },
  },
}));

const mockSerialGet = jest.fn();
jest.mock('../../../shared/services/serials', () => ({
  SerialService: { get: (...a: unknown[]) => mockSerialGet(...a) },
}));

const mockMarkRead = jest.fn();
const mockMarkUnread = jest.fn();
let readStatusChangedHandler: ((p: unknown) => void) | null = null;
const mockChapterOpenedExec = jest.fn();
const mockChapterEvents = jest.fn((_args: { seriesId: string; chapterId: string }) => ({
  opened: { exec: mockChapterOpenedExec, key: { name: 'chapter/opened' } },
}));
jest.mock('../../../shared/tools/chapters', () => ({
  ChapterTool: {
    format: { title: (c: { title: string }) => c.title },
    mark: {
      read: (...a: unknown[]) => mockMarkRead(...a),
      unread: (...a: unknown[]) => mockMarkUnread(...a),
    },
  },
  ChapterEvents: { readStatusChanged: { name: 'chapterReadStatusChanged' } },
  chapterEvents: (args: { seriesId: string; chapterId: string }) => mockChapterEvents(args),
}));

jest.mock('../../../shared/managers/events', () => ({
  createEvent: (name: string) => ({ name }),
  EventBus: { emit: jest.fn() },
  useEvent: (_token: unknown, handler: (p: unknown) => void) => {
    readStatusChangedHandler = handler;
  },
}));

const mockProgressGet = jest.fn().mockResolvedValue(null);
const mockProgressSetLocal = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../shared/managers/store', () => ({
  ReadingProgressManager: {
    get: (...a: unknown[]) => mockProgressGet(...a),
    set: (...a: unknown[]) => mockProgressSetLocal(...a),
  },
}));

const mockReadingModeGet = jest.fn().mockResolvedValue({ mode: 'webtoon' });
jest.mock('../reading-mode.tool', () => ({
  ReadingModeTool: { get: (...a: unknown[]) => mockReadingModeGet(...a) },
}));

jest.mock('../reader.screen-control', () => ({
  ReaderScreenControl: {
    fetchKeepScreenOnPref: jest.fn().mockResolvedValue(false),
    keepScreenOn: jest.fn().mockResolvedValue(undefined),
    allowScreenOff: jest.fn().mockResolvedValue(undefined),
    fetchImmersiveModePref: jest.fn().mockResolvedValue(false),
    setImmersiveMode: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) },
}));

// Controllable AppState — appStateChange(state) fires whatever the hook registered.
let appStateHandler: ((s: string) => void) | null = null;
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: (_type: string, handler: (s: string) => void) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  },
  currentState: 'active',
}));

import { useReader } from '../hooks/reader.hooks';

// ── digest fixtures ─────────────────────────────────────────────────────

function pages(n: number) {
  return {
    count: n,
    readCount: 0,
    list: Array.from({ length: n }, (_, i) => ({ isSuccess: true, url: `p${i}`, width: 100, height: 150 })),
  };
}

function chapterDigest(
  id: string,
  number: number,
  opts: { prev?: string; next?: string; pageCount?: number } = {},
) {
  return {
    isSuccess: true,
    id,
    seriesId: 's1',
    number,
    decimalNumber: number,
    title: id,
    readStatus: 'UNREAD',
    pages: pages(opts.pageCount ?? 5),
    prevChapter: opts.prev
      ? { isSuccess: true, id: opts.prev, seriesId: 's1', number: number - 1, title: opts.prev, readStatus: 'UNREAD', pages: pages(5) }
      : undefined,
    nextChapter: opts.next
      ? { isSuccess: true, id: opts.next, seriesId: 's1', number: number + 1, title: opts.next, readStatus: 'UNREAD', pages: pages(5) }
      : undefined,
  };
}

function seriesDigest(ids: string[]) {
  return {
    isSuccess: true,
    name: 'Minha Série',
    chapters: {
      list: ids.map((id, i) => ({
        isSuccess: true,
        id,
        seriesId: 's1',
        number: i + 1,
        decimalNumber: i + 1,
        title: id,
        readStatus: 'UNREAD',
      })),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  readStatusChangedHandler = null;
  appStateHandler = null;
  mockProgressGet.mockResolvedValue(null);
  mockReadingModeGet.mockResolvedValue({ mode: 'webtoon' });
  mockSerialGet.mockResolvedValue(seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5']));
});

// ── tests ───────────────────────────────────────────────────────────────

describe('useReader V2 — open', () => {
  it('opens the chapter and builds a window focused on it', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    const w = result.current.window!;
    expect(w.entries[w.focusedIndex].chapter.id).toBe('c3');
    expect(w.entries[w.focusedIndex].status).toBe('ready');
  });

  it('surfaces an error (no window) when the digest resolves as Failure', async () => {
    mockGetFull.mockResolvedValue({ isSuccess: false, error: { message: 'not found' } });
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.error).toBe('not found'));
    expect(result.current.window).toBeNull();
  });

  it('resolves the initial page from local progress when newer than the server', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1, { next: 'c2', pageCount: 20 }));
    mockProgressGet.mockResolvedValue({ seriesId: 's1', page: 8, scrollFraction: 0.3, updatedAtEpochMs: 999 });
    const { result } = renderHook(() => useReader('s1', 'c1'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    expect(result.current.currentVisiblePage).toBe(8);
  });
});

describe('useReader V2 — backAction', () => {
  it('always falls back to its own series screen, with canUseGoBack so real history (an in-app screen the user came from) still wins first', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    expect(result.current.backAction).toEqual({
      navigate: { back: { route: 'series/:seriesId', params: { seriesId: 's1' }, canUseGoBack: true, canResetStack: true } },
    });
  });
});

describe('useReader V2 — chapter navigation', () => {
  it('the arrow RELOADS the next chapter (fresh window centered on it) — "location.replace"', async () => {
    mockGetFull.mockImplementation(({ chapterId }: { chapterId: string }) =>
      Promise.resolve(
        chapterId === 'c3'
          ? chapterDigest('c3', 3, { prev: 'c2', next: 'c4' })
          : chapterDigest('c4', 4, { prev: 'c3', next: 'c5' }),
      ),
    );
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3'));
    mockGetFull.mockClear();

    act(() => result.current.goToAdjacent('next'));

    // openChapter('c4') runs: getFull for c4, a fresh window centered on c4
    await waitFor(() => expect(mockGetFull).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c4', force: undefined }));
    await waitFor(() =>
      expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c4'),
    );
    expect(result.current.currentVisiblePage).toBe(0); // starts at the top
  });

  it('announces chapter/opened for the chapter that was actually opened', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1));
    const { result } = renderHook(() => useReader('s1', 'c1'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    expect(mockChapterEvents).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1' });
    expect(mockChapterOpenedExec).toHaveBeenCalledTimes(1);
  });

  it('keeps the reader usable when a listener of chapter/opened throws', async () => {
    mockChapterOpenedExec.mockImplementationOnce(() => {
      throw new Error('listener exploded');
    });
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1));

    const { result } = renderHook(() => useReader('s1', 'c1'));

    // Announcing is a side errand of opening — the window still loads and no error surfaces.
    await waitFor(() => expect(result.current.window).not.toBeNull());
    expect(result.current.error).toBeNull();
  });

  it('the arrow at the true series end is a no-op (no reload)', async () => {
    // c5 is the last chapter in the mocked series order (see beforeEach)
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5, { prev: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c5'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c5'));
    mockGetFull.mockClear();

    act(() => result.current.goToAdjacent('next'));

    // nothing after c5 → openChapter never called
    await new Promise<void>(resolve => setTimeout(() => resolve(), 10));
    expect(mockGetFull).not.toHaveBeenCalled();
  });

  it('goToChapter jumps to ANY chapter of the series, not just the adjacent one (the overlay picker)', async () => {
    mockGetFull.mockImplementation(({ chapterId }: { chapterId: string }) =>
      Promise.resolve(
        chapterId === 'c1'
          ? chapterDigest('c1', 1, { next: 'c2' })
          : chapterDigest('c5', 5, { prev: 'c4' }),
      ),
    );
    const { result } = renderHook(() => useReader('s1', 'c1'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c1'));
    mockGetFull.mockClear();

    act(() => result.current.goToChapter('c5'));

    await waitFor(() => expect(mockGetFull).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c5', force: undefined }));
    await waitFor(() =>
      expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c5'),
    );
    expect(result.current.currentVisiblePage).toBe(0); // starts at the top, same as an arrow reload
  });

  it('a native-scroll report for the focused chapter is a position-only update, not a focus move', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4', pageCount: 10 }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    act(() => result.current.onNativePosition('c3', 4, 0.5, 0.45));

    expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3');
    expect(result.current.currentVisiblePage).toBe(4);
    expect(result.current.chapterFraction).toBe(0.45);
  });

  it('drops an internally-inconsistent native-scroll report (page near the end, chapterFraction ~0)', async () => {
    // Device rc35: Kotlin emitted page=9/10 with chapterFraction=0.009 mid-transition. Adopting it
    // splits the overlay — dots jump to the end, progress bar stays empty. The report is dropped.
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4', pageCount: 10 }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    const pageBefore = result.current.currentVisiblePage;
    const fracBefore = result.current.chapterFraction;

    act(() => result.current.onNativePosition('c3', 9, 1, 0.009));

    expect(result.current.currentVisiblePage).toBe(pageBefore); // unchanged
    expect(result.current.chapterFraction).toBe(fracBefore); // unchanged
  });

  it('a native scroll event that arrives right at open (before window ready) does not crash', async () => {
    // Repro of the rc30 device crash: onVisiblePageChanged fired on the first frame and the
    // handler dereferenced an undefined adapter. onNativePosition must be a no-op safe call at
    // any time, including before the window exists.
    mockGetFull.mockReturnValue(new Promise(() => {})); // never resolves — window stays null
    const { result } = renderHook(() => useReader('s1', 'c1'));
    expect(() => {
      act(() => result.current.onNativePosition('c1', 0, 0, 0));
    }).not.toThrow();
  });

  it('a native-scroll crossing into the next neighbour slides the focus', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3'));

    act(() => result.current.handleScrollRequestHandled());
    act(() => result.current.onNativePosition('c3', 0, 0, 0.01));
    act(() => result.current.onNativePosition('c4', 0, 0, 0.02));

    expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c4');
  });
});

describe('useReader V2 — neighbour prefetch', () => {
  it('prefetches the placeholder NEXT chapter of the opened one', async () => {
    // buildWindow is [opened, next] — the prev is added only by a backward scroll, so only the
    // next placeholder is prefetched on open.
    mockGetFull.mockImplementation(({ chapterId }: { chapterId: string }) =>
      Promise.resolve(
        chapterId === 'c3'
          ? chapterDigest('c3', 3) // no embedded next → c4 lands as a placeholder
          : chapterDigest(chapterId, Number(chapterId.slice(1))),
      ),
    );
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3'));

    await waitFor(() => expect(mockGetFull).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c4' }));
  });
});

describe('useReader V2 — cross-screen mark', () => {
  it('applies a readStatusChanged event for a chapter in the window', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    act(() => readStatusChangedHandler!({ chapter: { id: 'c3', seriesId: 's1' }, changed: { readStatus: 'READ' } }));

    const focused = result.current.window!.entries[result.current.window!.focusedIndex].chapter;
    expect(focused.readStatus).toBe('READ');
  });

  it('ignores a readStatusChanged event for a chapter not in the window', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    act(() => readStatusChangedHandler!({ chapter: { id: 'cZ', seriesId: 's1' }, changed: { readStatus: 'READ' } }));

    expect(
      result.current.window!.entries.every(e => e.chapter.readStatus === 'UNREAD'),
    ).toBe(true);
  });
});


describe('useReader V2 — series name', () => {
  it('uses the hint without waiting on a fetch', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1, { next: 'c2' }));
    const { result } = renderHook(() => useReader('s1', 'c1', 'Hint Name'));
    expect(result.current.seriesName).toBe('Hint Name');
  });

  it('fetches the series name when no hint is given', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1, { next: 'c2' }));
    const { result } = renderHook(() => useReader('s1', 'c1'));
    await waitFor(() => expect(result.current.seriesName).toBe('Minha Série'));
  });
});

describe('useReader V2 — arrow enablement', () => {
  it('hasPrevChapter/hasNextChapter come from the canonical order, not the window shape', async () => {
    // series order is c1..c5 (beforeEach). Open c3, whose window is just [c3, c4].
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3'));

    // window has no entry before c3, but the series does → ▲ enabled
    expect(result.current.hasPrevChapter).toBe(true);
    expect(result.current.hasNextChapter).toBe(true);
  });

  it('hasPrevChapter is false at the first chapter of the series', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c1', 1));
    const { result } = renderHook(() => useReader('s1', 'c1'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c1'));

    expect(result.current.hasPrevChapter).toBe(false);
    expect(result.current.hasNextChapter).toBe(true);
  });

  it('hasNextChapter is false at the last chapter of the series', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5));
    const { result } = renderHook(() => useReader('s1', 'c5'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c5'));

    expect(result.current.hasPrevChapter).toBe(true);
    expect(result.current.hasNextChapter).toBe(false);
  });
});

describe('useReader V2 — progress flush (Task 030 gaps)', () => {
  it('onScreenExit flushes the focused chapter to BOTH stores', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => result.current.onScreenExit());

    expect(mockProgressSetLocal).toHaveBeenCalledWith('c3', expect.objectContaining({ seriesId: 's1' }));
    expect(mockProgressSet).toHaveBeenCalledWith(expect.objectContaining({ chapterId: 'c3', seriesId: 's1' }));
  });

  it('GAP 1: backgrounding the app flushes the focused chapter', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    expect(appStateHandler).toBeInstanceOf(Function);
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => appStateHandler!('background'));

    expect(mockProgressSetLocal).toHaveBeenCalledWith('c3', expect.any(Object));
    expect(mockProgressSet).toHaveBeenCalledWith(expect.objectContaining({ chapterId: 'c3' }));
  });

  it('GAP 1: an "active" AppState change does NOT flush', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => appStateHandler!('active'));

    expect(mockProgressSetLocal).not.toHaveBeenCalled();
    expect(mockProgressSet).not.toHaveBeenCalled();
  });

  it('GAP 2: an arrow to the next chapter flushes the chapter being left', async () => {
    mockGetFull.mockImplementation(({ chapterId }: { chapterId: string }) =>
      Promise.resolve(chapterDigest(chapterId, Number(chapterId.slice(1)), { next: 'c4' })),
    );
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window!.entries[result.current.window!.focusedIndex].chapter.id).toBe('c3'));
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => result.current.goToAdjacent('next'));

    // c3 (the outgoing chapter) is flushed before the window rebuilds to c4
    expect(mockProgressSetLocal).toHaveBeenCalledWith('c3', expect.any(Object));
    expect(mockProgressSet).toHaveBeenCalledWith(expect.objectContaining({ chapterId: 'c3' }));
  });

  it('GAP 2: reopening the SAME chapter does not flush it', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => result.current.loadChapter('c3'));

    expect(mockProgressSetLocal).not.toHaveBeenCalled();
    expect(mockProgressSet).not.toHaveBeenCalled();
  });

  it('does not hit the server for a chapter that is already effectively read', async () => {
    mockGetFull.mockResolvedValue({
      ...chapterDigest('c3', 3, { next: 'c4' }),
      readStatus: 'READ',
      pages: { count: 5, readCount: 5, list: pages(5).list },
    });
    const { result } = renderHook(() => useReader('s1', 'c3'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    mockProgressSetLocal.mockClear();
    mockProgressSet.mockClear();

    act(() => result.current.onScreenExit());

    expect(mockProgressSetLocal).toHaveBeenCalledWith('c3', expect.any(Object)); // local always
    expect(mockProgressSet).not.toHaveBeenCalled(); // server skipped for a read chapter
  });
});

describe('useReader V2 — stale series order', () => {
  const forcedCalls = () => mockSerialGet.mock.calls.filter(([args]) => args?.force === true);

  it('refreshes the order with force when the opened chapter is not in it (a chapter that just arrived)', async () => {
    mockSerialGet.mockImplementation(({ force }: { force?: boolean }) =>
      Promise.resolve(force ? seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) : seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5'])),
    );
    mockGetFull.mockResolvedValue(chapterDigest('c6', 6, { prev: 'c5' }));
    const { result } = renderHook(() => useReader('s1', 'c6', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    await waitFor(() => expect(result.current.order.map(c => c.id)).toContain('c6'));
    expect(forcedCalls()).toHaveLength(1);
    expect(result.current.hasPrevChapter).toBe(true);
  });

  it('finds the chapters after the cached last one when the opened chapter was that last entry', async () => {
    mockSerialGet.mockImplementation(({ force }: { force?: boolean }) =>
      Promise.resolve(force ? seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) : seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5'])),
    );
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5, { prev: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c5', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());

    await waitFor(() => expect(result.current.hasNextChapter).toBe(true));
    expect(forcedCalls()).toHaveLength(1);
  });

  it('does not force when the opened chapter has a next one in the order', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c3', 3, { prev: 'c2', next: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c3', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    await waitFor(() => expect(result.current.hasNextChapter).toBe(true));

    expect(forcedCalls()).toHaveLength(0);
  });

  it('forces only once per open, even when the forced order still ends at the focused chapter', async () => {
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5, { prev: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c5', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    await waitFor(() => expect(forcedCalls()).toHaveLength(1));
    await act(async () => {});

    expect(forcedCalls()).toHaveLength(1);
    expect(result.current.hasNextChapter).toBe(false);
  });

  it('keeps the cached order when the forced refresh fails', async () => {
    mockSerialGet.mockImplementation(({ force }: { force?: boolean }) =>
      force ? Promise.reject(new Error('offline')) : Promise.resolve(seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5'])),
    );
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5, { prev: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c5', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    await waitFor(() => expect(forcedCalls()).toHaveLength(1));
    await act(async () => {});

    expect(result.current.order).toHaveLength(5);
  });

  it('ignores a forced refresh that comes back as a failure digest', async () => {
    mockSerialGet.mockImplementation(({ force }: { force?: boolean }) =>
      Promise.resolve(force ? { isSuccess: false, error: { message: 'x' } } : seriesDigest(['c1', 'c2', 'c3', 'c4', 'c5'])),
    );
    mockGetFull.mockResolvedValue(chapterDigest('c5', 5, { prev: 'c4' }));
    const { result } = renderHook(() => useReader('s1', 'c5', 'Minha Série'));
    await waitFor(() => expect(result.current.window).not.toBeNull());
    await waitFor(() => expect(forcedCalls()).toHaveLength(1));
    await act(async () => {});

    expect(result.current.order).toHaveLength(5);
  });
});
