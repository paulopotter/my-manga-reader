import type {
  ChapterDigestSuccess,
  ChapterNeighborDigestSuccess,
  SerialDigestSuccess,
} from '../../../shared/bridge/digest';
import type { OrderedChapter, ReaderChapter } from '../reader.types';
import {
  adjacentChapterId,
  chapterFromDigest,
  chapterPosition,
  isChapterEffectivelyRead,
  neighborsOfIn,
  progressBarFraction,
  resolveInitialPage,
  shouldUnmarkOnReread,
  toOrderedChapters,
  withOrderNumber,
} from '../reader.model';

// ── fixtures ────────────────────────────────────────────────────────────

function order(ids: string[]): OrderedChapter[] {
  return ids.map((id, i) => ({
    id,
    seriesId: 's1',
    number: i + 1,
    decimalNumber: i + 1,
    title: `Ch ${i + 1}`,
    readStatus: 'UNREAD' as const,
  }));
}

function readerChapter(id: string, over: Partial<ReaderChapter> = {}): ReaderChapter {
  return {
    id,
    seriesId: 's1',
    number: 1,
    title: id,
    readStatus: 'UNREAD',
    pageCount: 10,
    pagesRead: 0,
    pageUrls: Array.from({ length: 10 }, (_, i) => `${id}-p${i}`),
    pageAspectRatios: Array.from({ length: 10 }, () => 1.5),
    serverResume: null,
    ...over,
  };
}

// ── chapterFromDigest ───────────────────────────────────────────────────

describe('chapterFromDigest', () => {
  it('maps a full ChapterDigestSuccess to the flat ReaderChapter shape', () => {
    const digest = {
      isSuccess: true,
      id: 'c1',
      seriesId: 's1',
      number: 3,
      decimalNumber: 3,
      title: 'The Arrival',
      readStatus: 'IN_PROGRESS',
      pages: {
        count: 2,
        readCount: 1,
        resumePoint: { stoppedAtPageIndex: 1, recordedAtEpochMs: 5000 },
        list: [
          { isSuccess: true, url: 'u0', width: 100, height: 150 },
          { isSuccess: true, url: 'u1', width: 100, height: 200 },
        ],
      },
    } as unknown as ChapterDigestSuccess;

    expect(chapterFromDigest(digest)).toEqual({
      id: 'c1',
      seriesId: 's1',
      number: 3,
      decimalNumber: 3,
      specialLabel: undefined,
      isSpecial: undefined,
      title: 'The Arrival',
      readStatus: 'IN_PROGRESS',
      pageCount: 2,
      pagesRead: 1,
      pageUrls: ['u0', 'u1'],
      pageAspectRatios: [1.5, 2],
      serverResume: { page: 1, recordedAtEpochMs: 5000 },
    });
  });

  it('keeps index alignment when a page failed to resolve', () => {
    const digest = {
      isSuccess: true,
      id: 'c1',
      seriesId: 's1',
      title: '1',
      readStatus: 'UNREAD',
      pages: {
        list: [
          { isSuccess: true, url: 'u0', width: 100, height: 100 },
          { isSuccess: false, error: { code: 'x', message: 'boom' } },
        ],
      },
    } as unknown as ChapterNeighborDigestSuccess;

    const c = chapterFromDigest(digest);
    expect(c.pageUrls).toEqual(['u0', '']);
    expect(c.pageAspectRatios).toEqual([1, null]);
  });

  it('serverResume is null when there is no resume point', () => {
    const digest = {
      isSuccess: true,
      id: 'c1',
      seriesId: 's1',
      title: '1',
      readStatus: 'UNREAD',
      pages: { list: [] },
    } as unknown as ChapterDigestSuccess;
    expect(chapterFromDigest(digest).serverResume).toBeNull();
  });
});

// ── withOrderNumber ─────────────────────────────────────────────────────

describe('withOrderNumber', () => {
  it('overrides the chapter number with the series-order one', () => {
    const c = readerChapter('c2', { number: 103 });
    const result = withOrderNumber(c, order(['c1', 'c2', 'c3']));
    expect(result.number).toBe(2);
  });

  it('leaves the chapter untouched when it is not in the order', () => {
    const c = readerChapter('cX', { number: 42 });
    expect(withOrderNumber(c, order(['c1', 'c2']))).toBe(c);
  });
});

// ── isChapterEffectivelyRead ────────────────────────────────────────────

describe('isChapterEffectivelyRead', () => {
  it('is true when readStatus is READ', () => {
    expect(isChapterEffectivelyRead(readerChapter('c1', { readStatus: 'READ' }))).toBe(true);
  });
  it('is true when pagesRead / pageCount crosses 95%', () => {
    expect(isChapterEffectivelyRead(readerChapter('c1', { pageCount: 100, pagesRead: 95 }))).toBe(true);
  });
  it('is false below 95%', () => {
    expect(isChapterEffectivelyRead(readerChapter('c1', { pageCount: 100, pagesRead: 94 }))).toBe(false);
  });
  it('is false when pageCount is 0', () => {
    expect(isChapterEffectivelyRead(readerChapter('c1', { pageCount: 0, pagesRead: 0 }))).toBe(false);
  });
});

// ── resolveInitialPage ──────────────────────────────────────────────────

describe('resolveInitialPage', () => {
  it('starts at 0 for a read chapter, ignoring local progress', () => {
    const c = readerChapter('c1', { readStatus: 'READ' });
    expect(resolveInitialPage(c, { page: 5, scrollFraction: 0.2, updatedAtEpochMs: 9999 })).toEqual({
      page: 0,
      scrollFraction: 0,
    });
  });
  it('local wins when it is newer than the server resume point', () => {
    const c = readerChapter('c1', { serverResume: { page: 2, recordedAtEpochMs: 100 } });
    expect(resolveInitialPage(c, { page: 7, scrollFraction: 0.3, updatedAtEpochMs: 200 })).toEqual({
      page: 7,
      scrollFraction: 0.3,
    });
  });
  it('server wins when its resume point is newer', () => {
    const c = readerChapter('c1', { serverResume: { page: 2, recordedAtEpochMs: 300 } });
    expect(resolveInitialPage(c, { page: 7, scrollFraction: 0.3, updatedAtEpochMs: 200 })).toEqual({
      page: 2,
      scrollFraction: 0,
    });
  });
  it('local wins when the server point has no timestamp', () => {
    const c = readerChapter('c1', { serverResume: { page: 2, recordedAtEpochMs: null } });
    expect(resolveInitialPage(c, { page: 7, scrollFraction: 0.3, updatedAtEpochMs: 1 })).toEqual({
      page: 7,
      scrollFraction: 0.3,
    });
  });
  it('uses the server resume page when there is no local record', () => {
    const c = readerChapter('c1', { serverResume: { page: 4, recordedAtEpochMs: 1 } });
    expect(resolveInitialPage(c, null)).toEqual({ page: 4, scrollFraction: 0 });
  });
  it('falls back to the start', () => {
    expect(resolveInitialPage(readerChapter('c1'), null)).toEqual({ page: 0, scrollFraction: 0 });
  });
});

// ── shouldUnmarkOnReread ────────────────────────────────────────────────

describe('shouldUnmarkOnReread', () => {
  it('is true when read on open and not at the last page', () => {
    expect(shouldUnmarkOnReread(true, 3, 10, false)).toBe(true);
  });
  it('is false when it was not read on open', () => {
    expect(shouldUnmarkOnReread(false, 3, 10, false)).toBe(false);
  });
  it('is false when already unmarked this session', () => {
    expect(shouldUnmarkOnReread(true, 3, 10, true)).toBe(false);
  });
  it('is false at the last page', () => {
    expect(shouldUnmarkOnReread(true, 9, 10, false)).toBe(false);
  });
});

// ── toOrderedChapters / neighborsOfIn ───────────────────────────────────

describe('toOrderedChapters', () => {
  it('sorts successful chapters ascending by number, dropping failures', () => {
    const digest = {
      chapters: {
        list: [
          { isSuccess: true, id: 'c3', seriesId: 's1', number: 3, title: '3', readStatus: 'UNREAD' },
          { isSuccess: false, error: { code: 'x', message: 'y' } },
          { isSuccess: true, id: 'c1', seriesId: 's1', number: 1, title: '1', readStatus: 'READ' },
        ],
      },
    } as unknown as SerialDigestSuccess;
    expect(toOrderedChapters(digest).map(c => c.id)).toEqual(['c1', 'c3']);
  });

  it('orders a chapter with a number before one without, then falls back to title compare', () => {
    const digest = {
      chapters: {
        list: [
          { isSuccess: true, id: 'z', seriesId: 's1', title: 'Zeta', readStatus: 'UNREAD' },
          { isSuccess: true, id: 'a', seriesId: 's1', title: 'Alpha', readStatus: 'UNREAD' },
          { isSuccess: true, id: 'n', seriesId: 's1', number: 2, title: 'Numbered', readStatus: 'UNREAD' },
        ],
      },
    } as unknown as SerialDigestSuccess;
    // numbered first, then the two number-less ones by title
    expect(toOrderedChapters(digest).map(c => c.id)).toEqual(['n', 'a', 'z']);
  });
});

describe('neighborsOfIn', () => {
  const list = order(['a', 'b', 'c']);
  it('returns both neighbours in the middle', () => {
    expect(neighborsOfIn(list, 'b')).toEqual({ prevId: 'a', nextId: 'c' });
  });
  it('returns null at the ends', () => {
    expect(neighborsOfIn(list, 'a')).toEqual({ prevId: null, nextId: 'b' });
    expect(neighborsOfIn(list, 'c')).toEqual({ prevId: 'b', nextId: null });
  });
  it('returns null/null for an unknown id', () => {
    expect(neighborsOfIn(list, 'zzz')).toEqual({ prevId: null, nextId: null });
  });
});

describe('progressBarFraction', () => {
  it('clamps to 0..1', () => {
    expect(progressBarFraction(-0.5)).toBe(0);
    expect(progressBarFraction(1.5)).toBe(1);
    expect(progressBarFraction(0.4)).toBe(0.4);
  });
});

// ── adjacentChapterId ──────────────────────────────────────────────────

describe('adjacentChapterId', () => {
  const o = order(['c1', 'c2', 'c3', 'c4', 'c5']);

  it('returns the next / previous id', () => {
    expect(adjacentChapterId(o, 'c3', 'next')).toBe('c4');
    expect(adjacentChapterId(o, 'c3', 'prev')).toBe('c2');
  });

  it('returns null at the series ends', () => {
    expect(adjacentChapterId(o, 'c5', 'next')).toBeNull();
    expect(adjacentChapterId(o, 'c1', 'prev')).toBeNull();
  });

  it('returns null for an unknown chapter or empty order', () => {
    expect(adjacentChapterId(o, 'zzz', 'next')).toBeNull();
    expect(adjacentChapterId([], 'c1', 'next')).toBeNull();
  });
});

describe('chapterPosition', () => {
  const o = order(['c1', 'c2', 'c3']);

  it('is 1-indexed over the whole series', () => {
    expect(chapterPosition(o, 'c1')).toEqual({ position: 1, total: 3 });
    expect(chapterPosition(o, 'c3')).toEqual({ position: 3, total: 3 });
  });

  it('is null when the order is empty or does not hold the chapter', () => {
    expect(chapterPosition([], 'c1')).toBeNull();
    expect(chapterPosition(o, 'zzz')).toBeNull();
  });
});
