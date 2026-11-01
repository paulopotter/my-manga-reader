import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../../shared/i18n', () => ({
  useStrings: () => require('../../../shared/i18n/strings').getStrings('en'),
}));

// Run the focus callback once on mount, like a screen gaining focus.
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) };
});

// Identity unless a test installs a rule: stands in for the adult filter's read-time pass.
const mockAdult = jest.fn((items: unknown[]) => items);
jest.mock('../../../shared/context/adult-filter', () => ({
  // The real hook hands every item to idOf; do the same so the callers' id selectors run.
  useAdultFiltered: ({ items, idOf }: { items: unknown[]; idOf: (item: unknown) => string }) => {
    items.forEach(item => idOf(item));
    return mockAdult(items);
  },
}));

const mockSerialsGet = jest.fn();
const mockSerialGet = jest.fn();
jest.mock('../../../shared/services/serials', () => ({
  SerialsService: { get: (...a: unknown[]) => mockSerialsGet(...a) },
  SerialService: { get: (...a: unknown[]) => mockSerialGet(...a) },
}));

const mockLocalProgress = jest.fn();
const mockHiddenGet = jest.fn();
const mockHiddenHide = jest.fn();
jest.mock('../../../shared/managers/store', () => ({
  ReadingProgressManager: { get: (...a: unknown[]) => mockLocalProgress(...a) },
  HiddenContinueManager: {
    get: (...a: unknown[]) => mockHiddenGet(...a),
    hide: (...a: unknown[]) => mockHiddenHide(...a),
  },
}));

const mockFollowedIds = jest.fn();
jest.mock('../../../shared/services/followed-series', () => ({
  FollowedSeriesService: { ids: { get: (...a: unknown[]) => mockFollowedIds(...a) } },
}));

import { useDashboard } from './dashboard.hooks';

const NOW = 1_800_000_000_000;

function digest(id: string, extra: Record<string, unknown> = {}) {
  return {
    isSuccess: true,
    id,
    name: `Serie ${id}`,
    coverImage: { url: `cover-${id}` },
    resolvedAtEpochMs: 0,
    server: {},
    cache: null,
    ...extra,
  };
}

function serialsDigest() {
  return {
    isSuccess: true,
    lastUpdatedEpochMs: NOW,
    serials: [
      digest('1', { pages: { read: 5, total: 10 }, lastUpdatesUTC: { readDate: NOW, chapterAdded: NOW - 1000 } }),
      digest('2', { pages: { read: 0, total: 10 }, lastUpdatesUTC: { chapterAdded: NOW } }),
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalProgress.mockResolvedValue(null);
  mockHiddenGet.mockResolvedValue(new Map());
  mockHiddenHide.mockResolvedValue(undefined);
  mockAdult.mockImplementation((items: unknown[]) => items);
  mockSerialsGet.mockResolvedValue(serialsDigest());
  mockFollowedIds.mockResolvedValue(['2']);
  mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) =>
    Promise.resolve(
      digest(seriesId, {
        chapters: {
          total: 1,
          list: [],
          resumePoint: { stoppedAtChapterId: 'c1', stoppedAtChapterIndex: 0, status: 'UNREAD' },
        },
      }),
    ),
  );
});

describe('useDashboard', () => {
  it('loads the rails cache-first on focus', async () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockSerialsGet).toHaveBeenCalledWith({ force: false });
    expect(mockSerialGet).toHaveBeenCalledWith({ seriesId: '1', force: false });
    await waitFor(() => expect(result.current.data!.continueReading).toHaveLength(1));
    const data = result.current.data!;
    expect(data.continueReading.map(i => i.chapterId)).toEqual(['c1']);
    expect(data.followedUpdated.map(i => i.seriesId)).toEqual(['2']);
    expect(data.stats).toEqual({ series: 2, followed: 1, inProgress: 1 });
  });

  it('skips a candidate whose digest fails and still renders the rest', async () => {
    mockSerialGet.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data!.continueReading).toEqual([]);
    expect(result.current.data!.recentlyUpdated).toHaveLength(2);
  });

  it('tolerates a followed-ids failure by treating nothing as followed', async () => {
    mockFollowedIds.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data!.stats.followed).toBe(0);
  });

  it('reports an error when the series list fails, and retry reloads', async () => {
    mockSerialsGet.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('reports an error when the list digest is a failure', async () => {
    mockSerialsGet.mockResolvedValueOnce({ isSuccess: false, error: { code: 'x', message: 'nope' } });
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('pull-to-refresh is the only force, and a failed reload keeps what is on screen', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockSerialsGet).toHaveBeenLastCalledWith({ force: true });
    // Both the "continue reading" candidate and the "followed series updated" one are asked for fresh.
    expect(mockSerialGet).toHaveBeenCalledWith({ seriesId: '1', force: true });
    expect(mockSerialGet).toHaveBeenCalledWith({ seriesId: '2', force: true });
    expect(result.current.refreshing).toBe(false);

    mockSerialsGet.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.data).not.toBeNull();
  });
});

describe('useDashboard — series refreshed after reading', () => {
  it('re-reads the cache when a series was re-fetched', async () => {
    const { EventBus } = require('../../../shared/managers/events');
    const { SerieEvents } = require('../../../shared/tools/serials');
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    mockSerialsGet.mockClear();
    await act(async () => {
      EventBus.emit(SerieEvents.refreshed, { seriesId: '1' });
    });
    await waitFor(() => expect(mockSerialsGet).toHaveBeenCalledWith({ force: false }));
  });
});

describe('useDashboard — adult filter', () => {
  it('builds every rail and the stats from what the filter lets through, and marks blurred ones', async () => {
    mockAdult.mockImplementation((items: unknown[]) =>
      (items as Array<{ id: string }>)
        .filter(serie => serie.id !== '2')
        .map(serie => ({ ...serie, blurred: serie.id === '1' })),
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const data = result.current.data!;
    expect(data.stats.series).toBe(1);
    expect(data.recentlyUpdated.map(i => i.seriesId)).toEqual(['1']);
    expect(data.recentlyUpdated[0].blurred).toBe(true);
    expect(data.continueReading.every(i => i.seriesId !== '2')).toBe(true);
    expect(data.continueReading[0].blurred).toBe(true);
  });

  describe('painting before the digests arrive', () => {
    const resume = (chapterId: string) => ({
      chapters: { total: 1, list: [], resumePoint: { stoppedAtChapterId: chapterId, stoppedAtChapterIndex: 0, status: 'UNREAD' } },
    });
    const inProgress = (id: string, readDate: number) =>
      digest(id, { pages: { read: 5, total: 10 }, lastUpdatesUTC: { readDate, chapterAdded: NOW - 5000 } });

    it('shows every rail built from the list while a digest is still being fetched', async () => {
      mockSerialGet.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useDashboard());

      await waitFor(() => expect(result.current.status).toBe('ready'));

      expect(result.current.data!.recentlyUpdated).toHaveLength(2);
      expect(result.current.data!.stats.series).toBe(2);
      expect(result.current.data!.continueReading).toEqual([]);
    });

    it('fills "continue reading" in as the digests land, one tile at a time, in reading order', async () => {
      mockSerialsGet.mockResolvedValue({
        isSuccess: true,
        lastUpdatedEpochMs: NOW,
        serials: [inProgress('1', NOW), inProgress('2', NOW - 1)],
      });
      const release: Record<string, (value: unknown) => void> = {};
      mockSerialGet.mockImplementation(
        ({ seriesId }: { seriesId: string }) => new Promise(resolve => (release[seriesId] = resolve)),
      );
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBe('ready'));
      await waitFor(() => expect(Object.keys(release)).toHaveLength(2));

      // The second series answers first: its tile shows alone.
      await act(async () => release['2'](digest('2', resume('c2'))));
      await waitFor(() => expect(result.current.data!.continueReading.map(i => i.chapterId)).toEqual(['c2']));

      // Then the first: both, the most recently read first.
      await act(async () => release['1'](digest('1', resume('c1'))));
      await waitFor(() => expect(result.current.data!.continueReading.map(i => i.chapterId)).toEqual(['c1', 'c2']));
    });

    it('keeps the tiles already on screen while a reload fetches the digests again', async () => {
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));

      mockSerialGet.mockReturnValue(new Promise(() => {}));
      act(() => result.current.retry());
      await waitFor(() => expect(mockSerialsGet).toHaveBeenCalledTimes(2));

      expect(result.current.data!.continueReading).toHaveLength(1);
    });

    it('never shrinks the rail while a reload brings the digests back one by one', async () => {
      mockSerialsGet.mockResolvedValue({
        isSuccess: true,
        lastUpdatedEpochMs: NOW,
        serials: [inProgress('1', NOW), inProgress('2', NOW - 1)],
      });
      mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => Promise.resolve(digest(seriesId, resume(`c${seriesId}`))));
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(2));

      const seen: number[] = [];
      mockSerialGet.mockImplementation(
        ({ seriesId }: { seriesId: string }) =>
          new Promise(resolve => setTimeout(() => resolve(digest(seriesId, resume(`c${seriesId}`))), seriesId === '1' ? 5 : 15)),
      );
      act(() => result.current.retry());
      await waitFor(() => expect(mockSerialGet).toHaveBeenCalledTimes(4));
      await waitFor(() => {
        seen.push(result.current.data?.continueReading.length ?? 0);
        expect(seen.length).toBeGreaterThan(5);
      });

      expect(Math.min(...seen)).toBe(2);
    });

    it('says the rail is loading until its first tile lands, and not again once one is shown', async () => {
      mockSerialsGet.mockResolvedValue({ isSuccess: true, lastUpdatedEpochMs: NOW, serials: [inProgress('1', NOW)] });
      let release: (value: unknown) => void = () => {};
      mockSerialGet.mockImplementation(() => new Promise(resolve => (release = resolve)));
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBe('ready'));
      await waitFor(() => expect(result.current.continueLoading).toBe(true));

      await act(async () => release(digest('1', resume('c1'))));
      await waitFor(() => expect(result.current.continueLoading).toBe(false));
      expect(result.current.data!.continueReading).toHaveLength(1);

      mockSerialGet.mockReturnValue(new Promise(() => {}));
      act(() => result.current.retry());
      await waitFor(() => expect(mockSerialsGet).toHaveBeenCalledTimes(2));
      expect(result.current.continueLoading).toBe(false);
    });

    it('fetches at most four digests at a time', async () => {
      mockSerialsGet.mockResolvedValue({
        isSuccess: true,
        lastUpdatedEpochMs: NOW,
        serials: Array.from({ length: 6 }, (_, i) => inProgress(String(i + 1), NOW - i)),
      });
      mockSerialGet.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBe('ready'));

      await waitFor(() => expect(mockSerialGet).toHaveBeenCalledTimes(4));
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      expect(mockSerialGet).toHaveBeenCalledTimes(4);
    });

    it('logs one timing line per load so a slow open can be told apart', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));
      await waitFor(() => expect(log).toHaveBeenCalled());

      expect(String(log.mock.calls[0][0])).toMatch(/^\[dashboard\] list=\d+ms digests=\d+ms candidates=1 force=false$/);
      log.mockRestore();
    });
  });
});

describe('useDashboard — followed series updated', () => {
  const unreadResume = (chapterId: string, number: number) => ({
    chapters: {
      total: 1,
      list: [{ isSuccess: true, id: chapterId, number, title: `Cap ${number}`, readStatus: 'UNREAD', pages: { count: 10, readCount: 0 } }],
      resumePoint: { stoppedAtChapterId: chapterId, stoppedAtChapterIndex: 0, status: 'UNREAD' },
    },
  });

  it('shows the next chapter to read for a followed series with something new', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => Promise.resolve(digest(seriesId, unreadResume('c9', 9))));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.data?.followedUpdated).toHaveLength(1));

    expect(result.current.data!.followedUpdated[0].seriesId).toBe('2');
    expect(result.current.data!.followedUpdated[0].caption).toBe('Next: Ch. 9');
    expect(result.current.followedLoading).toBe(false);
  });

  it('drops the series once its digest says there is nothing left to read', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => Promise.resolve(digest(seriesId, { chapters: { total: 1, list: [] } })));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.followedLoading).toBe(false));
    await waitFor(() => expect(mockSerialGet).toHaveBeenCalledWith({ seriesId: '2', force: false }));

    expect(result.current.data!.followedUpdated).toEqual([]);
  });

  it('holds the place of the rail while its digests are on the way', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => (seriesId === '2' ? new Promise(() => {}) : Promise.resolve(digest(seriesId, unreadResume('c1', 1)))));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await waitFor(() => expect(result.current.followedLoading).toBe(true));
    expect(result.current.data!.followedUpdated).toEqual([]);
  });

  it('keeps the series, with the time of the update, when its digest fails', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) =>
      seriesId === '2' ? Promise.reject(new Error('boom')) : Promise.resolve(digest(seriesId, unreadResume('c1', 1))),
    );
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.data?.followedUpdated).toHaveLength(1));

    expect(result.current.data!.followedUpdated[0].seriesId).toBe('2');
  });
});

describe('useDashboard — progress from the device', () => {
  const novelDigest = (seriesId: string) =>
    digest(seriesId, {
      chapters: {
        total: 1,
        list: [{ isSuccess: true, id: 'c1', number: 3, title: 'Vol 3', readStatus: 'UNREAD', pages: { count: 1, readCount: 0 } }],
        resumePoint: { stoppedAtChapterId: 'c1', stoppedAtChapterIndex: 0, status: 'UNREAD' },
      },
    });

  it('shows the position the device saved in the chapter, though the server has read nothing', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => Promise.resolve(novelDigest(seriesId)));
    mockLocalProgress.mockImplementation((chapterId: string) =>
      Promise.resolve(chapterId === 'c1' ? { seriesId: '1', page: 0, scrollFraction: 0.4, updatedAtEpochMs: NOW } : null),
    );
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.data?.continueReading[0]?.progressFraction).toBeCloseTo(0.4));

    expect(result.current.data!.continueReading[0].progressLabel).toBe('40% read');
  });

  it('has no bar when the device saved nothing', async () => {
    mockSerialGet.mockImplementation(({ seriesId }: { seriesId: string }) => Promise.resolve(novelDigest(seriesId)));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));
    await waitFor(() => expect(mockLocalProgress).toHaveBeenCalled());

    expect(result.current.data!.continueReading[0].progressFraction).toBeUndefined();
  });
});

describe('useDashboard — hiding a series from "continue reading"', () => {
  it('leaves a hidden series out of "continue reading" and "not finished yet", and never asks for its digest', async () => {
    mockHiddenGet.mockResolvedValue(new Map([['1', NOW]]));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.continueLoading).toBe(false));
    expect(result.current.data!.continueReading).toEqual([]);
    expect(result.current.data!.unfinished).toEqual([]);
    expect(mockSerialGet).not.toHaveBeenCalledWith(expect.objectContaining({ seriesId: '1' }));
    // Hidden from those rails, but still part of the library.
    expect(result.current.data!.stats.inProgress).toBe(1);
  });

  it('brings the series back once it was read after it was hidden', async () => {
    mockHiddenGet.mockResolvedValue(new Map([['1', NOW - 1]]));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));
  });

  it('treats a failing read of the hidden ones as nothing hidden', async () => {
    mockHiddenGet.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));
  });

  it('hideContinue remembers the last read date, then reloads cache-first so the tile goes', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));

    mockHiddenGet.mockResolvedValue(new Map([['1', NOW]]));
    mockSerialsGet.mockClear();
    await act(async () => {
      await result.current.hideContinue({ seriesId: '1' });
    });

    expect(mockHiddenHide).toHaveBeenCalledWith({ seriesId: '1', readDateEpochMs: NOW });
    expect(mockSerialsGet).toHaveBeenCalledWith({ force: false });
    await waitFor(() => expect(result.current.data!.continueReading).toEqual([]));
    expect(result.current.data!.unfinished).toEqual([]);
  });

  it('hideContinue ignores a series it does not know', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.hideContinue({ seriesId: 'nope' });
    });
    expect(mockHiddenHide).not.toHaveBeenCalled();
  });

  it('hideContinue leaves the rails alone when remembering it fails', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.data?.continueReading).toHaveLength(1));
    mockHiddenHide.mockRejectedValue(new Error('disk'));
    mockSerialsGet.mockClear();
    await act(async () => {
      await result.current.hideContinue({ seriesId: '1' });
    });
    expect(mockSerialsGet).not.toHaveBeenCalled();
    expect(result.current.data!.continueReading).toHaveLength(1);
  });
});
