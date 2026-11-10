import { getStrings } from '../../shared/i18n/strings';
import type { Serie } from '../../shared/tools/serials';
import { CONTINUE_CANDIDATE_BUFFER, DASHBOARD_LIMITS, DashboardTool } from './dashboard.tool';

const t = getStrings('en');
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

function serie(over: Partial<Serie> & { id: string }): Serie {
  return {
    name: `Serie ${over.id}`,
    coverImage: { url: `cover-${over.id}` } as Serie['coverImage'],
    chapters: [],
    resolvedAtEpochMs: 0,
    server: {} as Serie['server'],
    events: {} as Serie['events'],
    ...over,
  };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => jest.restoreAllMocks());

describe('DashboardTool.continueCandidates', () => {
  it('keeps only started-and-unfinished series, most recently read first, plus the buffer', () => {
    const series = [
      serie({ id: 'unread', pages: { read: 0, total: 10 } }),
      serie({ id: 'done', pages: { read: 10, total: 10 }, lastUpdatesUTC: { readDate: NOW } }),
      serie({ id: 'old', pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW - 5 * HOUR } }),
      serie({ id: 'new', pages: { read: 4, total: 10 }, lastUpdatesUTC: { readDate: NOW - HOUR } }),
      serie({ id: 'nopages' }),
    ];
    expect(DashboardTool.continueCandidates({ series, limit: 5 }).map(s => s.id)).toEqual(['new', 'old']);
  });

  it('caps at limit + buffer', () => {
    const series = Array.from({ length: 20 }, (_, i) =>
      serie({ id: String(i), pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW - i } }),
    );
    expect(DashboardTool.continueCandidates({ series, limit: 3 })).toHaveLength(3 + CONTINUE_CANDIDATE_BUFFER);
  });

  it('treats a missing or year-1 read date as the oldest', () => {
    const series = [
      serie({ id: 'never', pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: -62_135_596_800_000 } }),
      serie({ id: 'some', pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW } }),
    ];
    expect(DashboardTool.continueCandidates({ series, limit: 5 }).map(s => s.id)).toEqual(['some', 'never']);
  });
});

describe('DashboardTool.continueItem', () => {
  const chapter = (over: Record<string, unknown>) =>
    ({ id: 'c10', number: 10, pages: { count: 20, readCount: 5, list: [] }, ...over }) as unknown as Serie['chapters'][number];

  it('opens the resume chapter with its number and a chapter progress bar', () => {
    const item = DashboardTool.continueItem({
      serie: serie({
        id: 's1',
        chapters: [chapter({})],
        resumePoint: { stoppedAtChapterId: 'c10', stoppedAtChapterIndex: 9, status: 'IN_PROGRESS' },
      }),
      t,
    });
    expect(item).toEqual({
      seriesId: 's1',
      chapterId: 'c10',
      name: 'Serie s1',
      coverUrl: 'cover-s1',
      caption: 'Ch. 10',
      progressFraction: 0.25,
      progressLabel: '25% read',
    });
  });

  it('prefers the decimal number and shows a special chapter by its label', () => {
    const decimal = DashboardTool.continueItem({
      serie: serie({
        id: 's1',
        chapters: [chapter({ decimalNumber: 10.5 })],
        resumePoint: { stoppedAtChapterId: 'c10', stoppedAtChapterIndex: 9, status: 'IN_PROGRESS' },
      }),
      t,
    });
    expect(decimal?.caption).toBe('Ch. 10.5');
    const special = DashboardTool.continueItem({
      serie: serie({
        id: 's1',
        chapters: [chapter({ isSpecial: true, specialLabel: 'Extra' })],
        resumePoint: { stoppedAtChapterId: 'c10', stoppedAtChapterIndex: 9, status: 'IN_PROGRESS' },
      }),
      t,
    });
    expect(special?.caption).toBe('Ch. Extra');
  });

  it('draws no bar when the chapter is unread, has no page counts or nothing was read in it', () => {
    const base = { id: 's1', resumePoint: { stoppedAtChapterId: 'c10', stoppedAtChapterIndex: 9, status: 'UNREAD' as const } };
    expect(
      DashboardTool.continueItem({ serie: serie({ ...base, chapters: [chapter({})] }), t })?.progressFraction,
    ).toBeUndefined();
    const inProgress = { ...base, resumePoint: { ...base.resumePoint, status: 'IN_PROGRESS' as const } };
    expect(
      DashboardTool.continueItem({
        serie: serie({ ...inProgress, chapters: [chapter({ pages: { list: [] } })] }),
        t,
      })?.progressFraction,
    ).toBeUndefined();
    expect(
      DashboardTool.continueItem({
        serie: serie({ ...inProgress, chapters: [chapter({ pages: { count: 20, readCount: 0, list: [] } })] }),
        t,
      })?.progressFraction,
    ).toBeUndefined();
  });

  it('still opens the chapter, with no caption, when the resume chapter is not in the list', () => {
    const item = DashboardTool.continueItem({
      serie: serie({ id: 's1', resumePoint: { stoppedAtChapterId: 'zz', stoppedAtChapterIndex: 0, status: 'UNREAD' } }),
      t,
    });
    expect(item?.chapterId).toBe('zz');
    expect(item?.caption).toBeUndefined();
  });

  it('returns null when every chapter is read (no resume point)', () => {
    expect(DashboardTool.continueItem({ serie: serie({ id: 's1' }), t })).toBeNull();
  });
});

describe('DashboardTool.followedUpdatedCandidates', () => {
  it('lists followed series whose newest chapter is later than their last read, newest first', () => {
    const series = [
      serie({ id: 'a', lastUpdatesUTC: { chapterAdded: NOW - 2 * HOUR, readDate: NOW - 5 * HOUR } }),
      serie({ id: 'b', lastUpdatesUTC: { chapterAdded: NOW - HOUR } }),
      serie({ id: 'caught-up', lastUpdatesUTC: { chapterAdded: NOW - 5 * HOUR, readDate: NOW - HOUR } }),
      serie({ id: 'not-followed', lastUpdatesUTC: { chapterAdded: NOW } }),
      serie({ id: 'no-date' }),
    ];
    const candidates = DashboardTool.followedUpdatedCandidates({
      series,
      followedIds: new Set(['a', 'b', 'caught-up', 'no-date']),
      exclude: new Set(),
      limit: 5,
    });
    expect(candidates.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('leaves out what "continue reading" owns', () => {
    const series = [
      serie({ id: 'a', lastUpdatesUTC: { chapterAdded: NOW - HOUR } }),
      serie({ id: 'b', lastUpdatesUTC: { chapterAdded: NOW - 2 * HOUR } }),
    ];
    const candidates = DashboardTool.followedUpdatedCandidates({
      series,
      followedIds: new Set(['a', 'b']),
      exclude: new Set(['a']),
      limit: 5,
    });
    expect(candidates.map(c => c.id)).toEqual(['b']);
  });

  it('takes the limit plus the buffer, since some will have nothing left to read', () => {
    const series = Array.from({ length: 20 }, (_, i) => serie({ id: String(i), lastUpdatesUTC: { chapterAdded: NOW - i * HOUR } }));
    const candidates = DashboardTool.followedUpdatedCandidates({
      series,
      followedIds: new Set(series.map(s => s.id)),
      exclude: new Set(),
      limit: 2,
    });
    expect(candidates).toHaveLength(2 + CONTINUE_CANDIDATE_BUFFER);
  });
});

describe('DashboardTool.followedUpdated', () => {
  const candidate = (id: string, hoursAgo = 1) => serie({ id, lastUpdatesUTC: { chapterAdded: NOW - hoursAgo * HOUR } });
  const withResume = (id: string, chapterNumber: number) =>
    serie({
      id,
      resumePoint: { stoppedAtChapterId: 'c1', stoppedAtChapterIndex: 0, status: 'UNREAD' },
      chapters: [{ id: 'c1', number: chapterNumber } as Serie['chapters'][number]],
    });
  const run = (over: Partial<Parameters<typeof DashboardTool.followedUpdated>[0]>) =>
    DashboardTool.followedUpdated({ candidates: [], digests: new Map(), exclude: new Set(), limit: 5, t, ...over });

  it('shows the next chapter to read instead of the time of the update', () => {
    const items = run({ candidates: [candidate('a')], digests: new Map([['a', withResume('a', 12)]]) });
    expect(items).toHaveLength(1);
    expect(items[0].caption).toBe(t.dashboardNextChapter.replace('{0}', '12'));
  });

  it('drops a series whose digest says everything is read', () => {
    const items = run({ candidates: [candidate('a'), candidate('b')], digests: new Map([['a', serie({ id: 'a' })], ['b', withResume('b', 3)]]) });
    expect(items.map(i => i.seriesId)).toEqual(['b']);
  });

  it('keeps a series whose digest could not be had, with the time of the update', () => {
    const items = run({ candidates: [candidate('a', 2)], digests: new Map([['a', null]]) });
    expect(items[0].caption).toBe(t.dateHoursAgo.replace('{0}', '2'));
  });

  it('waits for a digest that is still on its way instead of showing the series', () => {
    expect(run({ candidates: [candidate('a')], digests: new Map() })).toEqual([]);
  });

  it('leaves out excluded series and respects the limit', () => {
    const digests = new Map([['a', withResume('a', 1)], ['b', withResume('b', 2)], ['c', withResume('c', 3)]]);
    const items = run({ candidates: [candidate('a'), candidate('b'), candidate('c')], digests, exclude: new Set(['a']), limit: 1 });
    expect(items.map(i => i.seriesId)).toEqual(['b']);
  });
});

describe('DashboardTool.followedUpdated — only a new chapter at the end', () => {
  const candidate = serie({ id: 'a', lastUpdatesUTC: { chapterAdded: NOW - HOUR } });
  const chapter = (id: string, number: number, readStatus: 'READ' | 'UNREAD') => ({ id, number, readStatus }) as Serie['chapters'][number];
  const digestWith = (chapters: Serie['chapters']) =>
    serie({ id: 'a', resumePoint: { stoppedAtChapterId: chapters.find(c => c.readStatus !== 'READ')!.id, stoppedAtChapterIndex: 0, status: 'UNREAD' }, chapters });
  const run = (digest: Serie, onlyNewAtEnd?: boolean) =>
    DashboardTool.followedUpdated({ candidates: [candidate], digests: new Map([['a', digest]]), exclude: new Set(), limit: 5, onlyNewAtEnd, t });

  it('drops a series whose only unread chapter is older than the last one read', () => {
    const digest = digestWith([chapter('c25', 25, 'UNREAD'), chapter('c40', 40, 'READ')]);
    expect(run(digest)).toEqual([]);
  });

  it('keeps a series with an unread chapter beyond the last one read, even with an old gap too', () => {
    const digest = digestWith([chapter('c25', 25, 'UNREAD'), chapter('c40', 40, 'READ'), chapter('c41', 41, 'UNREAD')]);
    expect(run(digest).map(i => i.seriesId)).toEqual(['a']);
  });

  it('keeps a series with nothing read yet, and one whose unread chapter has no number', () => {
    expect(run(digestWith([chapter('c1', 1, 'UNREAD')])).map(i => i.seriesId)).toEqual(['a']);
    const special = { id: 'sp', isSpecial: true, specialLabel: 'Extra', readStatus: 'UNREAD' } as Serie['chapters'][number];
    expect(run(digestWith([chapter('c40', 40, 'READ'), special])).map(i => i.seriesId)).toEqual(['a']);
  });

  it('shows the old-chapter series again when the setting is off', () => {
    const digest = digestWith([chapter('c25', 25, 'UNREAD'), chapter('c40', 40, 'READ')]);
    expect(run(digest, false).map(i => i.seriesId)).toEqual(['a']);
  });
});

describe('DashboardTool.sameDigests', () => {
  const digest = (id: string, chapterId: string) =>
    serie({ id, resumePoint: { stoppedAtChapterId: chapterId, stoppedAtChapterIndex: 0, status: 'UNREAD' } });

  it('is true for the same tiles even from different objects, and false when one differs', () => {
    expect(DashboardTool.sameDigests({ previous: new Map([['a', digest('a', 'c1')]]), next: new Map([['a', digest('a', 'c1')]]) })).toBe(true);
    expect(DashboardTool.sameDigests({ previous: new Map([['a', digest('a', 'c1')]]), next: new Map([['a', digest('a', 'c2')]]) })).toBe(false);
    expect(DashboardTool.sameDigests({ previous: new Map([['a', null]]), next: new Map([['a', digest('a', 'c1')]]) })).toBe(false);
    expect(DashboardTool.sameDigests({ previous: new Map(), next: new Map([['a', null]]) })).toBe(false);
    expect(DashboardTool.sameDigests({ previous: new Map([['a', null]]), next: new Map([['a', null]]) })).toBe(true);
  });
});

describe('DashboardTool.recentlyUpdated', () => {
  it('sorts every series with a chapter date by it, newest first, within the limit', () => {
    const series = [
      serie({ id: 'a', lastUpdatesUTC: { chapterAdded: NOW - 3 * HOUR } }),
      serie({ id: 'b', lastUpdatesUTC: { chapterAdded: NOW - HOUR } }),
      serie({ id: 'never', lastUpdatesUTC: { chapterAdded: -62_135_596_800_000 } }),
      serie({ id: 'none' }),
    ];
    expect(DashboardTool.recentlyUpdated({ series, limit: 5, t }).map(i => i.seriesId)).toEqual(['b', 'a']);
    expect(DashboardTool.recentlyUpdated({ series, limit: 1, t })).toHaveLength(1);
  });
});

describe('DashboardTool.recentlyUpdated — fully read', () => {
  const series = [
    serie({ id: 'done', pages: { read: 10, total: 10 }, lastUpdatesUTC: { chapterAdded: NOW - HOUR } }),
    serie({ id: 'open', pages: { read: 3, total: 10 }, lastUpdatesUTC: { chapterAdded: NOW - 2 * HOUR } }),
    serie({ id: 'untouched', pages: { read: 0, total: 10 }, lastUpdatesUTC: { chapterAdded: NOW - 3 * HOUR } }),
    serie({ id: 'nopages', lastUpdatesUTC: { chapterAdded: NOW - 4 * HOUR } }),
  ];

  it('leaves out a series whose every page is read', () => {
    expect(DashboardTool.recentlyUpdated({ series, limit: 10, t }).map(i => i.seriesId)).toEqual(['open', 'untouched', 'nopages']);
  });

  it('keeps it when the setting is off', () => {
    expect(DashboardTool.recentlyUpdated({ series, limit: 10, hideFullyRead: false, t }).map(i => i.seriesId)).toEqual(['done', 'open', 'untouched', 'nopages']);
  });
});

describe('DashboardTool.recentlyAdded — window and what is already on the Home', () => {
  const DAY = 24 * HOUR;
  const series = [
    serie({ id: 'fresh', lastUpdatesUTC: { created: NOW - DAY } }),
    serie({ id: 'followed', lastUpdatesUTC: { created: NOW - 2 * DAY } }),
    serie({ id: 'reading', pages: { read: 2, total: 10 }, lastUpdatesUTC: { created: NOW - 3 * DAY } }),
    serie({ id: 'old', lastUpdatesUTC: { created: NOW - 10 * DAY } }),
  ];
  const settings = { newInLibraryWindowDays: 7, newInLibraryHideFollowedAndReading: true, recentlyUpdatedHideFullyRead: true, followedOnlyNewAtEnd: true };
  const ids = (over: Partial<Parameters<typeof DashboardTool.recentlyAdded>[0]> = {}) =>
    DashboardTool.recentlyAdded({ series, followedIds: new Set(['followed']), limit: 10, settings, now: NOW, t, ...over }).map(i => i.seriesId);

  it('shows only series created inside the window, without the followed or in-progress ones', () => {
    expect(ids()).toEqual(['fresh']);
  });

  it('keeps the followed and in-progress ones when that setting is off', () => {
    expect(ids({ settings: { ...settings, newInLibraryHideFollowedAndReading: false } })).toEqual(['fresh', 'followed', 'reading']);
  });

  it('follows the window the user chose', () => {
    expect(ids({ settings: { ...settings, newInLibraryHideFollowedAndReading: false, newInLibraryWindowDays: 30 } })).toEqual(['fresh', 'followed', 'reading', 'old']);
    expect(ids({ settings: { ...settings, newInLibraryHideFollowedAndReading: false, newInLibraryWindowDays: 1 } })).toEqual(['fresh']);
  });
});

describe('DashboardTool.recentlyAdded', () => {
  it('sorts by the date the series first appeared, newest first, ignoring undated ones', () => {
    const series = [
      serie({ id: 'a', lastUpdatesUTC: { created: NOW - 3 * HOUR } }),
      serie({ id: 'b', lastUpdatesUTC: { created: NOW - HOUR, chapterAdded: NOW } }),
      serie({ id: 'never', lastUpdatesUTC: { created: -62_135_596_800_000 } }),
      serie({ id: 'none' }),
    ];
    const items = DashboardTool.recentlyAdded({ series, limit: 5, t });
    expect(items.map(i => i.seriesId)).toEqual(['b', 'a']);
    expect(items[0].caption).toBe(t.dateHoursAgo.replace('{0}', '1'));
    expect(DashboardTool.recentlyAdded({ series, limit: 1, t })).toHaveLength(1);
  });
});

describe('DashboardTool.unfinished', () => {
  it('lists the series that are started and not finished, followed or not, most recently read first', () => {
    const series = [
      serie({ id: 'old', pages: { read: 2, total: 10 }, lastUpdatesUTC: { readDate: NOW - 5 * HOUR } }),
      serie({ id: 'recent', pages: { read: 5, total: 10 }, lastUpdatesUTC: { readDate: NOW - HOUR } }),
      serie({ id: 'never-started', pages: { read: 0, total: 10 } }),
      serie({ id: 'finished', pages: { read: 10, total: 10 } }),
      serie({ id: 'empty', pages: { read: 0, total: 0 } }),
      serie({ id: 'nopages' }),
    ];
    const items = DashboardTool.unfinished({ series, exclude: new Set(), limit: 5, t });
    expect(items.map(i => i.seriesId)).toEqual(['recent', 'old']);
    expect(items[0]).toMatchObject({ caption: '50% read', progressFraction: 0.5 });
  });

  it('leaves out what is excluded and respects the limit', () => {
    const series = Array.from({ length: 4 }, (_, i) =>
      serie({ id: String(i), pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW - i * HOUR } }),
    );
    expect(DashboardTool.unfinished({ series, exclude: new Set(['0']), limit: 2, t }).map(i => i.seriesId)).toEqual(['1', '2']);
  });
});

describe('DashboardTool.followedOwners', () => {
  it('is what "continue reading" and "not finished yet" own, from the list alone', () => {
    const series = [
      serie({ id: 'continue', pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW } }),
      serie({ id: 'unfinished', pages: { read: 1, total: 10 }, lastUpdatesUTC: { readDate: NOW - HOUR } }),
      serie({ id: 'never-started', pages: { read: 0, total: 10 } }),
    ];
    const owners = DashboardTool.followedOwners({ series, continueIds: new Set(['continue']) });
    expect([...owners].sort()).toEqual(['continue', 'unfinished']);
  });
});

describe('DashboardTool.stats', () => {
  it('counts the library, the followed series that exist and the series in progress', () => {
    const series = [
      serie({ id: 'a', pages: { read: 1, total: 10 } }),
      serie({ id: 'b', pages: { read: 10, total: 10 } }),
      serie({ id: 'c' }),
    ];
    expect(DashboardTool.stats({ series, followedIds: new Set(['a', 'gone']) })).toEqual({
      series: 3,
      followed: 1,
      inProgress: 1,
    });
  });
});

describe('DashboardTool.build', () => {
  it('assembles every rail, dropping continue candidates with nothing to resume and capping the rail', () => {
    const resumable = Array.from({ length: DASHBOARD_LIMITS.continueReading + 2 }, (_, i) =>
      serie({
        id: `r${i}`,
        resumePoint: { stoppedAtChapterId: `c${i}`, stoppedAtChapterIndex: 0, status: 'UNREAD' },
      }),
    );
    const data = DashboardTool.build({
      series: [serie({ id: 'x', lastUpdatesUTC: { chapterAdded: NOW - HOUR } })],
      followedIds: new Set(['x']),
      continueSeries: [serie({ id: 'fully-read' }), ...resumable],
      continueIds: new Set(),
      localProgress: new Map(),
      followedDigests: new Map([['x', serie({ id: 'x', resumePoint: { stoppedAtChapterId: 'cx', stoppedAtChapterIndex: 0, status: 'UNREAD' } })]]),
      t,
    });
    expect(data.continueReading).toHaveLength(DASHBOARD_LIMITS.continueReading);
    expect(data.continueReading[0].seriesId).toBe('r0');
    expect(data.followedUpdated.map(i => i.seriesId)).toEqual(['x']);
    expect(data.recentlyUpdated.map(i => i.seriesId)).toEqual(['x']);
    expect(data.unfinished).toEqual([]);
    expect(data.recentlyAdded).toEqual([]);
    expect(data.stats).toEqual({ series: 1, followed: 1, inProgress: 0 });
  });
});

describe('DashboardTool.sameContinue', () => {
  const resumed = (over: Partial<Serie> = {}): Serie =>
    serie({
      id: '1',
      resumePoint: { stoppedAtChapterId: 'c1', stoppedAtChapterIndex: 0, status: 'IN_PROGRESS' },
      chapters: [{ id: 'c1', number: 3, pages: { count: 10, readCount: 4 } } as Serie['chapters'][number]],
      ...over,
    });

  it('is true for the same tiles, even when the digests are different objects', () => {
    expect(DashboardTool.sameContinue({ previous: [resumed()], next: [resumed()] })).toBe(true);
    expect(DashboardTool.sameContinue({ previous: [], next: [] })).toBe(true);
  });

  it('is false when the list grows or shrinks', () => {
    expect(DashboardTool.sameContinue({ previous: [resumed()], next: [] })).toBe(false);
  });

  it('is false when the chapter to resume, or how far the reader got, changed', () => {
    const moved = resumed({ resumePoint: { stoppedAtChapterId: 'c2', stoppedAtChapterIndex: 1, status: 'IN_PROGRESS' } });
    expect(DashboardTool.sameContinue({ previous: [resumed()], next: [moved] })).toBe(false);
    const further = resumed({ chapters: [{ id: 'c1', number: 3, pages: { count: 10, readCount: 7 } } as Serie['chapters'][number]] });
    expect(DashboardTool.sameContinue({ previous: [resumed()], next: [further] })).toBe(false);
  });
});

describe('DashboardTool — what a tile says it is made of', () => {
  const added = { lastUpdatesUTC: { chapterAdded: NOW - HOUR } };

  it('badges a novel and a PDF, and leaves a comic bare', () => {
    const series = [
      serie({ id: 'n', fileFormat: 'epub', ...added }),
      serie({ id: 'p', fileFormat: 'pdf', ...added }),
      serie({ id: 'c', fileFormat: 'image', ...added }),
      serie({ id: 'u', ...added }),
    ];
    const items = DashboardTool.recentlyUpdated({ series, limit: 10, t });
    const badgeOf = (id: string) => items.find(i => i.seriesId === id)?.badge;
    expect(badgeOf('n')).toBe(t.serieBadgeNovel);
    expect(badgeOf('p')).toBe(t.serieBadgePdf);
    expect(badgeOf('c')).toBeUndefined();
    expect(badgeOf('u')).toBeUndefined();
  });
});

describe('DashboardTool.build — a series is on the Home once', () => {
  const unread = { chapterAdded: NOW - HOUR };
  const resumable = (id: string) => serie({ id, resumePoint: { stoppedAtChapterId: `c-${id}`, stoppedAtChapterIndex: 0, status: 'UNREAD' } });
  const build = (over: Partial<Parameters<typeof DashboardTool.build>[0]>) =>
    DashboardTool.build({
      series: [],
      followedIds: new Set(),
      continueSeries: [],
      continueIds: new Set(),
      followedDigests: new Map(),
      localProgress: new Map(),
      t,
      ...over,
    });

  it('keeps what "continue reading" owns out of the rails below it', () => {
    const data = build({
      series: [
        serie({ id: 'owned', pages: { read: 3, total: 10 }, lastUpdatesUTC: { ...unread, readDate: NOW } }),
        serie({ id: 'other', pages: { read: 0, total: 10 }, lastUpdatesUTC: unread }),
      ],
      followedIds: new Set(['owned', 'other']),
      continueIds: new Set(['owned']),
      followedDigests: new Map([['other', resumable('other')]]),
    });
    expect(data.followedUpdated.map(i => i.seriesId)).toEqual(['other']);
    expect(data.unfinished).toEqual([]);
    // The discovery rails are not "things to do": they repeat.
    expect(data.recentlyUpdated.map(i => i.seriesId).sort()).toEqual(['other', 'owned']);
  });

  it('gives a started, unfinished series to "not finished yet" and not to "followed series updated"', () => {
    const data = build({
      series: [
        // Started and unfinished, followed, with a chapter added since: it is "not finished yet".
        serie({ id: 'started', pages: { read: 3, total: 10 }, lastUpdatesUTC: { ...unread, readDate: NOW - 2 * HOUR } }),
        // Never started, followed, new chapters: it is "followed series updated".
        serie({ id: 'fresh', pages: { read: 0, total: 10 }, lastUpdatesUTC: unread }),
      ],
      followedIds: new Set(['started', 'fresh']),
      followedDigests: new Map([['fresh', resumable('fresh')]]),
    });
    expect(data.unfinished.map(i => i.seriesId)).toEqual(['started']);
    expect(data.followedUpdated.map(i => i.seriesId)).toEqual(['fresh']);
  });

  it('drops a series that "continue reading" ended up showing though it was not owned up front', () => {
    const data = build({
      series: [serie({ id: 'promoted', pages: { read: 0, total: 10 }, lastUpdatesUTC: unread })],
      followedIds: new Set(['promoted']),
      continueSeries: [resumable('promoted')],
      followedDigests: new Map([['promoted', resumable('promoted')]]),
    });
    expect(data.continueReading.map(i => i.seriesId)).toEqual(['promoted']);
    expect(data.followedUpdated).toEqual([]);
    expect(data.unfinished).toEqual([]);
  });

  it('keeps "followed series updated" empty, not half-drawn, while its digests are on their way', () => {
    const data = build({
      series: [serie({ id: 'fresh', pages: { read: 0, total: 10 }, lastUpdatesUTC: unread })],
      followedIds: new Set(['fresh']),
    });
    expect(data.followedUpdated).toEqual([]);
  });
});

describe('DashboardTool.continueItem — progress from the device', () => {
  const resumeChapter = (over: Record<string, unknown> = {}) =>
    ({ id: 'c1', number: 5, pages: { count: 1, readCount: 0, ...over } }) as unknown as Serie['chapters'][number];
  const digest = (pages: Record<string, unknown> = {}, status: 'UNREAD' | 'IN_PROGRESS' = 'UNREAD') =>
    serie({
      id: 's1',
      chapters: [resumeChapter(pages)],
      resumePoint: { stoppedAtChapterId: 'c1', stoppedAtChapterIndex: 0, status },
    });

  it('shows how far the reader got when only the device knows (a novel is one page, the server sees 0)', () => {
    const item = DashboardTool.continueItem({ serie: digest(), t, local: { page: 0, scrollFraction: 0.4, updatedAtEpochMs: NOW } });
    expect(item?.progressFraction).toBeCloseTo(0.4);
    expect(item?.progressLabel).toBe('40% read');
  });

  it('counts the pages already behind the reader, across the chapter', () => {
    const item = DashboardTool.continueItem({ serie: digest({ count: 10 }), t, local: { page: 4, scrollFraction: 0.5, updatedAtEpochMs: NOW } });
    expect(item?.progressFraction).toBeCloseTo(0.45);
  });

  it('prefers the server when it heard of the reading after the device saved its position', () => {
    const item = DashboardTool.continueItem({
      serie: digest({ count: 10, readCount: 8, resumePoint: { recordedAtEpochMs: NOW } }, 'IN_PROGRESS'),
      t,
      local: { page: 1, scrollFraction: 0, updatedAtEpochMs: NOW - HOUR },
    });
    expect(item?.progressFraction).toBeCloseTo(0.8);
  });

  it('has no bar when neither the device nor the server has anything', () => {
    expect(DashboardTool.continueItem({ serie: digest(), t })?.progressFraction).toBeUndefined();
    expect(DashboardTool.continueItem({ serie: digest(), t, local: { page: 0, scrollFraction: 0, updatedAtEpochMs: NOW } })?.progressFraction).toBeUndefined();
  });
});

describe('DashboardTool — series hidden from "continue reading"', () => {
  const READ_AT = NOW - 2 * HOUR;
  const abandoned = (readDate = READ_AT) =>
    serie({ id: 'abandoned', pages: { read: 3, total: 10 }, lastUpdatesUTC: { readDate } });
  const other = serie({ id: 'other', pages: { read: 4, total: 10 }, lastUpdatesUTC: { readDate: NOW - 5 * HOUR } });

  it('lastReadOf is the last read date, 0 when never read', () => {
    expect(DashboardTool.lastReadOf({ serie: abandoned() })).toBe(READ_AT);
    expect(DashboardTool.lastReadOf({ serie: serie({ id: 'x' }) })).toBe(0);
    expect(DashboardTool.lastReadOf({ serie: serie({ id: 'y', lastUpdatesUTC: { readDate: -62_135_596_800_000 } }) })).toBe(0);
  });

  it('keeps a hidden series out of the candidates while it was not read since', () => {
    const hidden = new Map([['abandoned', READ_AT]]);
    expect(DashboardTool.continueCandidates({ series: [abandoned(), other], limit: 5, hidden }).map(s => s.id)).toEqual(['other']);
  });

  it('brings it back once it is read again (a newer read date)', () => {
    const hidden = new Map([['abandoned', READ_AT]]);
    const readAgain = abandoned(READ_AT + 1);
    expect(DashboardTool.continueCandidates({ series: [readAgain, other], limit: 5, hidden }).map(s => s.id)).toEqual(['abandoned', 'other']);
  });

  it('hides a series that was never read (date 0) until it is', () => {
    const neverRead = serie({ id: 'never', pages: { read: 3, total: 10 } });
    const hidden = new Map([['never', 0]]);
    expect(DashboardTool.continueCandidates({ series: [neverRead], limit: 5, hidden })).toEqual([]);
  });

  it('shows everything when nothing is hidden', () => {
    expect(DashboardTool.continueCandidates({ series: [abandoned(), other], limit: 5 })).toHaveLength(2);
    expect(DashboardTool.continueCandidates({ series: [abandoned(), other], limit: 5, hidden: new Map() })).toHaveLength(2);
  });

  it('does not let a hidden series fall into "not finished yet" either', () => {
    const hidden = new Map([['abandoned', READ_AT]]);
    const items = DashboardTool.unfinished({ series: [abandoned(), other], exclude: new Set(), limit: 5, hidden, t });
    expect(items.map(i => i.seriesId)).toEqual(['other']);
  });

  it('does not make a hidden series an owner of the rails below, so a followed update can still show it', () => {
    const hidden = new Map([['abandoned', READ_AT]]);
    const owners = DashboardTool.followedOwners({ series: [abandoned(), other], continueIds: new Set(), hidden });
    expect([...owners]).toEqual(['other']);
  });

  it('build leaves a hidden series out of "continue reading" and "not finished yet", but not out of the stats', () => {
    const hidden = new Map([['abandoned', READ_AT]]);
    const data = DashboardTool.build({
      series: [abandoned(), other],
      followedIds: new Set(),
      continueSeries: [],
      continueIds: new Set(),
      followedDigests: new Map(),
      localProgress: new Map(),
      hidden,
      t,
    });
    expect(data.unfinished.map(i => i.seriesId)).toEqual(['other']);
    expect(data.stats.inProgress).toBe(2);
  });
});
