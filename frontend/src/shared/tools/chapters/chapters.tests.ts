import { ChapterEvents, ChapterTool, ChaptersTool, type ChapterReadStatusChangedPayload } from './chapters.tool';

jest.mock('../../services/chapters', () => ({
  ChapterService: {
    get: jest.fn(),
    status: { set: jest.fn(), setMany: jest.fn(), patchCache: jest.fn().mockResolvedValue(undefined) },
  },
}));

jest.mock('../../managers/preferences', () => ({
  PreferencesManager: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { ChapterService } from '../../services/chapters';
import { EventBus } from '../../managers/events';
import { PreferencesManager } from '../../managers/preferences';
import { getStrings } from '../../i18n/strings';
import type { ChapterTitleFields } from './chapters.tool';
import type { ChapterDigestSuccess, ServerActiveInfo } from '../../bridge/digest';

const mockGet = ChapterService.get as jest.Mock;
const mockStatusSet = ChapterService.status.set as jest.Mock;
const mockPatchCache = ChapterService.status.patchCache as jest.Mock;
const mockStatusSetMany = ChapterService.status.setMany as jest.Mock;
const mockPrefsGet = PreferencesManager.get as jest.Mock;
const mockPrefsPut = PreferencesManager.put as jest.Mock;
const mockPrefsDelete = PreferencesManager.delete as jest.Mock;

// Lets a pending .then()/.catch() chain attached to a mock Promise settle before assertions run.
const flushPromises = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());

const server: ServerActiveInfo = {
  groupId: 'g1',
  groupName: 'group',
  providerId: 'kavita',
  urlId: 'u1',
  url: 'https://example.invalid',
  timeoutMs: 5000,
  priority: 0,
};

function makeChapter(overrides: Partial<ChapterDigestSuccess> = {}): ChapterDigestSuccess {
  return {
    isSuccess: true,
    id: 'c1',
    seriesId: 's1',
    title: 'Chapter 1',
    coverImage: { url: '', hasFetchedDimensions: false, resolvedAtEpochMs: 0, server, cache: null },
    readStatus: 'UNREAD',
    pages: { list: [] },
    resolvedAtEpochMs: 1,
    server,
    cache: null,
    ...overrides,
  };
}

describe('ChapterTool.format.title', () => {
  const t = getStrings('pt-BR');
  const fields = (o: Partial<ChapterTitleFields> = {}): ChapterTitleFields => ({ title: 'A Chegada', number: 1, ...o });

  it('prefixes a real title with the number', () => {
    expect(ChapterTool.format.title(fields({ number: 1, title: 'A Chegada' }), t)).toBe('1. A Chegada');
  });

  it('uses "Capítulo N" when the title is just the number', () => {
    expect(ChapterTool.format.title(fields({ number: 3, title: '3' }), t)).toBe('Capítulo 3');
  });

  it('uses "Capítulo N" when the title is a number in any shape ("6.0", "06", "6.00")', () => {
    expect(ChapterTool.format.title(fields({ number: 6, title: '6.0' }), t)).toBe('Capítulo 6');
    expect(ChapterTool.format.title(fields({ number: 6, title: '06' }), t)).toBe('Capítulo 6');
    expect(ChapterTool.format.title(fields({ number: 6, title: '6.00' }), t)).toBe('Capítulo 6');
  });

  it('uses "Capítulo N" even when the numeric title is a DIFFERENT number (Kavita off-by-one)', () => {
    // real cases seen on device: "105. 104", "6. 5" — the title is a bare number, so it's not a
    // real title regardless of which number it holds; show "Capítulo N" from the chapter's own num
    expect(ChapterTool.format.title(fields({ number: 105, title: '104' }), t)).toBe('Capítulo 105');
    expect(ChapterTool.format.title(fields({ number: 6, title: '5' }), t)).toBe('Capítulo 6');
  });

  it('uses "Capítulo N" for a fractional chapter whose title is also a number ("10.5")', () => {
    expect(
      ChapterTool.format.title(fields({ number: undefined, decimalNumber: 10.5, title: '10.5' }), t),
    ).toBe('Capítulo 10.5');
  });

  it('keeps a real title that merely starts with a number ("6: The Arrival", "12 Angry Men")', () => {
    expect(ChapterTool.format.title(fields({ number: 6, title: '6: The Arrival' }), t)).toBe('6. 6: The Arrival');
    expect(ChapterTool.format.title(fields({ number: 12, title: '12 Angry Men' }), t)).toBe('12. 12 Angry Men');
  });

  it('uses "Capítulo N" when the title is empty', () => {
    expect(ChapterTool.format.title(fields({ number: 7, title: '' }), t)).toBe('Capítulo 7');
  });

  it('shows the raw title when there is a real title but no number', () => {
    expect(
      ChapterTool.format.title(fields({ number: undefined, decimalNumber: undefined, title: 'A Chegada' }), t),
    ).toBe('A Chegada');
  });

  it('falls back to the untitled label when there is no title and no number', () => {
    expect(
      ChapterTool.format.title(fields({ number: undefined, decimalNumber: undefined, title: '' }), t),
    ).toBe('Sem título');
  });

  it('shows specialLabel when the chapter is special', () => {
    expect(
      ChapterTool.format.title(fields({ isSpecial: true, specialLabel: 'Extra', title: 'ignored' }), t),
    ).toBe('Extra');
  });

  it('falls back to the normal path when isSpecial is true but there is no specialLabel', () => {
    expect(
      ChapterTool.format.title(fields({ isSpecial: true, specialLabel: undefined, number: 1, title: 'A Chegada' }), t),
    ).toBe('1. A Chegada');
  });

  it('prefers number over decimalNumber', () => {
    expect(
      ChapterTool.format.title(fields({ number: 2, decimalNumber: 2.5, title: 'A Chegada' }), t),
    ).toBe('2. A Chegada');
  });

  it('falls back to decimalNumber when number is absent (fractional chapter)', () => {
    expect(
      ChapterTool.format.title(fields({ number: undefined, decimalNumber: 10.5, title: 'A Chegada' }), t),
    ).toBe('10.5. A Chegada');
  });
});

describe('ChapterTool.normalize', () => {
  it('copies every digest field onto the canonical shape', () => {
    const chapter = makeChapter({ id: 'c1', title: 'Chapter 1', decimalNumber: 1.5, number: 1 });
    const result = ChapterTool.normalize({ chapter, seriesId: 's1' });
    expect(result.id).toBe('c1');
    expect(result.seriesId).toBe('s1');
    expect(result.title).toBe('Chapter 1');
    expect(result.decimalNumber).toBe(1.5);
    expect(result.number).toBe(1);
    expect(result.readStatus).toBe('UNREAD');
  });

  it('attaches a navigate action to the reader route, without the origin (added later by useAction)', () => {
    const chapter = makeChapter({ id: 'c1' });
    const result = ChapterTool.normalize({ chapter, seriesId: 's1' });
    expect(result.action).toEqual({
      navigate: { to: { route: 'reader/:seriesId/:chapterId', params: { seriesId: 's1', chapterId: 'c1' } } },
    });
  });
});

describe('ChapterTool.mark.read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves immediately with the optimistic READ value, without waiting for the network', async () => {
    mockStatusSet.mockReturnValue(new Promise(() => {})); // never settles in this test
    const result = await ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('calls onUpdate immediately with the optimistic value', () => {
    mockStatusSet.mockReturnValue(new Promise(() => {}));
    const onUpdate = jest.fn();
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', onUpdate });
    expect(onUpdate).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('calls onUpdate again confirming READ once the write succeeds', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    const onUpdate = jest.fn();
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(1, { seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('reverts to UNREAD (default) via onUpdate when the write fails and no prevStatus was given', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    const onUpdate = jest.fn();
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'UNREAD' });
  });

  it('reverts to the given prevStatus via onUpdate when the write fails', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    const onUpdate = jest.fn();
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', prevStatus: 'IN_PROGRESS', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'IN_PROGRESS' });
  });

  it('works without an onUpdate callback', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    await expect(ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' })).resolves.toBeDefined();
    await flushPromises();
  });

  it('works without an onUpdate callback when the write fails', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    await expect(ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' })).resolves.toBeDefined();
    await flushPromises();
  });
});

describe('ChapterTool.mark.unread', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves immediately with the optimistic UNREAD value', async () => {
    mockStatusSet.mockReturnValue(new Promise(() => {}));
    const result = await ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1' });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'UNREAD' });
  });

  it('reverts to READ (default) via onUpdate when the write fails and no prevStatus was given', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    const onUpdate = jest.fn();
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('confirms UNREAD via onUpdate once the write succeeds', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    const onUpdate = jest.fn();
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'UNREAD' });
  });

  it('works without an onUpdate callback when the write fails', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    await expect(ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1' })).resolves.toBeDefined();
    await flushPromises();
  });

  it('reverts to the given prevStatus via onUpdate when the write fails', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    const onUpdate = jest.fn();
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1', prevStatus: 'IN_PROGRESS', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'IN_PROGRESS' });
  });
});

describe('ChapterTool.mark.readMany / unreadMany — batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('makes ONE setMany call for the whole list, not one per chapter', async () => {
    mockStatusSetMany.mockResolvedValue(undefined);
    await ChapterTool.mark.readMany({ seriesId: 's1', chapterIds: ['c1', 'c2', 'c3'] });
    expect(mockStatusSetMany).toHaveBeenCalledTimes(1);
    expect(mockStatusSetMany).toHaveBeenCalledWith({ seriesId: 's1', chapterIds: ['c1', 'c2', 'c3'], isRead: true });
    expect(mockStatusSet).not.toHaveBeenCalled();
  });

  it('fires the optimistic READ for every chapter immediately, then confirmed on success', async () => {
    mockStatusSetMany.mockResolvedValue(undefined);
    const onUpdate = jest.fn();
    ChapterTool.mark.readMany({ seriesId: 's1', chapterIds: ['c1', 'c2'], onUpdate });
    // optimistic: one call per chapter, synchronously
    expect(onUpdate.mock.calls.slice(0, 2)).toEqual([
      [{ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' }],
      [{ seriesId: 's1', chapterId: 'c2', readStatus: 'READ' }],
    ]);
    await flushPromises();
    // confirmed: same values again, per chapter
    expect(onUpdate.mock.calls.slice(2)).toEqual([
      [{ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' }],
      [{ seriesId: 's1', chapterId: 'c2', readStatus: 'READ' }],
    ]);
  });

  it('reverts EVERY chapter to its prevStatusById on a failed batch write', async () => {
    mockStatusSetMany.mockRejectedValue(new Error('server 500'));
    const onUpdate = jest.fn();
    ChapterTool.mark.readMany({
      seriesId: 's1',
      chapterIds: ['c1', 'c2'],
      prevStatusById: { c1: 'IN_PROGRESS', c2: 'UNREAD' },
      onUpdate,
    });
    await flushPromises();
    expect(onUpdate.mock.calls.slice(2)).toEqual([
      [{ seriesId: 's1', chapterId: 'c1', readStatus: 'IN_PROGRESS' }],
      [{ seriesId: 's1', chapterId: 'c2', readStatus: 'UNREAD' }],
    ]);
  });

  it('revert falls back to UNREAD (readMany) / READ (unreadMany) when a chapter has no prevStatus', async () => {
    mockStatusSetMany.mockRejectedValue(new Error('down'));
    const onRead = jest.fn();
    ChapterTool.mark.readMany({ seriesId: 's1', chapterIds: ['c1'], onUpdate: onRead });
    await flushPromises();
    expect(onRead).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'UNREAD' });

    const onUnread = jest.fn();
    mockStatusSetMany.mockRejectedValue(new Error('down'));
    ChapterTool.mark.unreadMany({ seriesId: 's1', chapterIds: ['c1'], onUpdate: onUnread });
    await flushPromises();
    expect(onUnread).toHaveBeenNthCalledWith(2, { seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('emits readStatusChanged optimistic + confirmed per chapter', async () => {
    mockStatusSetMany.mockResolvedValue(undefined);
    const events: ChapterReadStatusChangedPayload[] = [];
    const unsub = EventBus.on(ChapterEvents.readStatusChanged, p => events.push(p as ChapterReadStatusChangedPayload));
    ChapterTool.mark.unreadMany({ seriesId: 's1', chapterIds: ['c1', 'c2'], prevStatusById: { c1: 'READ', c2: 'READ' } });
    await flushPromises();
    unsub();
    expect(events.map(e => `${e.chapter.id}:${e.phase}:${e.changed.readStatus}`)).toEqual([
      'c1:optimistic:UNREAD',
      'c2:optimistic:UNREAD',
      'c1:confirmed:UNREAD',
      'c2:confirmed:UNREAD',
    ]);
  });

  it('resolves with the optimistic array', async () => {
    mockStatusSetMany.mockReturnValue(new Promise(() => {}));
    await expect(ChapterTool.mark.readMany({ seriesId: 's1', chapterIds: ['c1', 'c2'] })).resolves.toEqual([
      { seriesId: 's1', chapterId: 'c1', readStatus: 'READ' },
      { seriesId: 's1', chapterId: 'c2', readStatus: 'READ' },
    ]);
  });
});

describe('ChapterTool.mark.toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the real status and delegates to mark.read when it was UNREAD', async () => {
    mockGet.mockResolvedValue({ isSuccess: true, readStatus: 'UNREAD' });
    mockStatusSet.mockResolvedValue(undefined);
    const result = await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1' });
    expect(mockStatusSet).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: true });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('reads the real status and delegates to mark.read when it was IN_PROGRESS', async () => {
    mockGet.mockResolvedValue({ isSuccess: true, readStatus: 'IN_PROGRESS' });
    mockStatusSet.mockResolvedValue(undefined);
    const result = await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1' });
    expect(mockStatusSet).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: true });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });

  it('reads the real status and delegates to mark.unread when it was READ', async () => {
    mockGet.mockResolvedValue({ isSuccess: true, readStatus: 'READ' });
    mockStatusSet.mockResolvedValue(undefined);
    const result = await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1' });
    expect(mockStatusSet).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: false });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'UNREAD' });
  });

  it('passes the real status down as prevStatus, so a failed write reverts to it', async () => {
    mockGet.mockResolvedValue({ isSuccess: true, readStatus: 'IN_PROGRESS' });
    mockStatusSet.mockRejectedValue(new Error('network down'));
    const onUpdate = jest.fn();
    await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1', onUpdate });
    await flushPromises();
    expect(onUpdate).toHaveBeenLastCalledWith({ seriesId: 's1', chapterId: 'c1', readStatus: 'IN_PROGRESS' });
  });

  it('defaults to UNREAD as the assumed prior status when reading the digest fails', async () => {
    mockGet.mockResolvedValue({ isSuccess: false, error: { message: 'not found' } });
    mockStatusSet.mockResolvedValue(undefined);
    const result = await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1' });
    expect(mockStatusSet).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: true });
    expect(result).toEqual({ seriesId: 's1', chapterId: 'c1', readStatus: 'READ' });
  });
});

describe('ChapterTool.mark.* — ChapterEvents.readStatusChanged emissions', () => {
  let received: ChapterReadStatusChangedPayload[];
  let off: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    received = [];
    off = EventBus.on(ChapterEvents.readStatusChanged, p => received.push(p));
  });

  afterEach(() => off());

  it('mark.read emits optimistic then confirmed, carrying prevStatus when given', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', prevStatus: 'UNREAD' });
    await flushPromises();

    expect(received).toEqual([
      { chapter: { id: 'c1', seriesId: 's1' }, changed: { readStatus: 'READ', prevStatus: 'UNREAD' }, phase: 'optimistic' },
      { chapter: { id: 'c1', seriesId: 's1' }, changed: { readStatus: 'READ', prevStatus: 'UNREAD' }, phase: 'confirmed' },
    ]);
  });

  it('mark.read emits prevStatus undefined when the caller did not supply it', () => {
    mockStatusSet.mockReturnValue(new Promise(() => {}));
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' });

    expect(received[0]).toEqual({
      chapter: { id: 'c1', seriesId: 's1' },
      changed: { readStatus: 'READ', prevStatus: undefined },
      phase: 'optimistic',
    });
  });

  it('mark.read emits reverted with prevStatus READ so a listener can undo its optimistic +1', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1', prevStatus: 'IN_PROGRESS' });
    await flushPromises();

    expect(received[0].phase).toBe('optimistic');
    expect(received[1]).toEqual({
      chapter: { id: 'c1', seriesId: 's1' },
      changed: { readStatus: 'IN_PROGRESS', prevStatus: 'READ' },
      phase: 'reverted',
    });
  });

  it('mark.read patches the Kotlin digest cache once the write confirms, keeping it from contradicting a cache-first read elsewhere', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' });
    await flushPromises();

    expect(mockPatchCache).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: true });
  });

  it('mark.read does not patch the cache when the write fails (nothing to keep in sync with)', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' });
    await flushPromises();

    expect(mockPatchCache).not.toHaveBeenCalled();
  });

  it('mark.read swallows a patchCache failure — it never reverts the mark that already succeeded', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    mockPatchCache.mockRejectedValue(new Error('cache write failed'));
    ChapterTool.mark.read({ seriesId: 's1', chapterId: 'c1' });
    await flushPromises();

    expect(received.map(p => p.phase)).toEqual(['optimistic', 'confirmed']);
  });

  it('mark.unread emits optimistic then confirmed', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1', prevStatus: 'READ' });
    await flushPromises();

    expect(received.map(p => p.phase)).toEqual(['optimistic', 'confirmed']);
    expect(received[0].changed).toEqual({ readStatus: 'UNREAD', prevStatus: 'READ' });
  });

  it('mark.unread patches the Kotlin digest cache once the write confirms', async () => {
    mockStatusSet.mockResolvedValue(undefined);
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1' });
    await flushPromises();

    expect(mockPatchCache).toHaveBeenCalledWith({ seriesId: 's1', chapterId: 'c1', isRead: false });
  });

  it('mark.unread emits reverted with prevStatus UNREAD on write failure', async () => {
    mockStatusSet.mockRejectedValue(new Error('network down'));
    ChapterTool.mark.unread({ seriesId: 's1', chapterId: 'c1', prevStatus: 'READ' });
    await flushPromises();

    expect(received[1]).toEqual({
      chapter: { id: 'c1', seriesId: 's1' },
      changed: { readStatus: 'READ', prevStatus: 'UNREAD' },
      phase: 'reverted',
    });
  });

  it('mark.toggle forwards the real prior status (read from the digest) into the payload', async () => {
    mockGet.mockResolvedValue({ isSuccess: true, readStatus: 'IN_PROGRESS' });
    mockStatusSet.mockResolvedValue(undefined);
    await ChapterTool.mark.toggle({ seriesId: 's1', chapterId: 'c1' });
    await flushPromises();

    // IN_PROGRESS → toggle marks READ; every emission carries prevStatus: 'IN_PROGRESS'
    expect(received.every(p => p.changed.prevStatus === 'IN_PROGRESS')).toBe(true);
    expect(received[0].changed.readStatus).toBe('READ');
  });
});

describe('ChaptersTool.sort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get({ domain: "global" })', () => {
    it('returns the plain prefs when a global default was saved', async () => {
      mockPrefsGet.mockResolvedValue({ value: JSON.stringify({ mode: 'DESCENDING', progressPercent: 50 }) });
      const result = await ChaptersTool.sort.get({ domain: 'global' });
      expect(mockPrefsGet).toHaveBeenCalledWith({ key: 'global' });
      expect(result).toEqual({ mode: 'DESCENDING', progressPercent: 50 });
      expect('isOverride' in result).toBe(false);
    });

    it('falls back to the hardcoded default when no global was ever saved', async () => {
      mockPrefsGet.mockResolvedValue(null);
      const result = await ChaptersTool.sort.get({ domain: 'global' });
      expect(result).toEqual({ mode: 'ASCENDING', progressPercent: 50 });
    });

    // PreferencesManager identifies an entry by key alone, so another tool writing under the
    // same key leaves a value of the wrong shape here. It must read as "nothing stored" —
    // otherwise prefs.mode comes back undefined and every list silently reverts to ascending,
    // with no error anywhere.
    it.each([
      ['a value another tool wrote', JSON.stringify('enrichment')],
      ['malformed json', '{not json'],
      ['an object without a mode', JSON.stringify({ progressPercent: 90 })],
    ])('ignores %s and uses the default', async (_label, value) => {
      mockPrefsGet.mockResolvedValue({ value });
      const result = await ChaptersTool.sort.get({ domain: 'global' });
      expect(result).toEqual({ mode: 'ASCENDING', progressPercent: 50 });
    });
  });

  describe('get({ domain: "series" })', () => {
    it('returns the override plus isOverride:true when a per-series override exists', async () => {
      mockPrefsGet.mockResolvedValueOnce({ value: JSON.stringify({ mode: 'AUTO_FIXED', fixedThreshold: 3, progressPercent: 50 }) });
      const result = await ChaptersTool.sort.get({ domain: 'series', seriesId: 's1' });
      expect(mockPrefsGet).toHaveBeenCalledWith({ key: 's1' });
      expect(result).toEqual({ mode: 'AUTO_FIXED', fixedThreshold: 3, progressPercent: 50, isOverride: true });
    });

    it('falls through to the exact same global read when no override exists, without isOverride', async () => {
      mockPrefsGet
        .mockResolvedValueOnce(null) // series lookup — no override
        .mockResolvedValueOnce({ value: JSON.stringify({ mode: 'DESCENDING', progressPercent: 50 }) }); // global fallback
      const result = await ChaptersTool.sort.get({ domain: 'series', seriesId: 's1' });
      expect(mockPrefsGet).toHaveBeenNthCalledWith(1, { key: 's1' });
      expect(mockPrefsGet).toHaveBeenNthCalledWith(2, { key: 'global' });
      expect(result).toEqual({ mode: 'DESCENDING', progressPercent: 50 });
      expect('isOverride' in result).toBe(false);
    });

    it('falls back to the hardcoded default when neither the series nor the global was ever saved', async () => {
      mockPrefsGet.mockResolvedValue(null);
      const result = await ChaptersTool.sort.get({ domain: 'series', seriesId: 's1' });
      expect(result).toEqual({ mode: 'ASCENDING', progressPercent: 50 });
    });
  });

  describe('put', () => {
    it('writes to the global key when domain is "global"', async () => {
      mockPrefsPut.mockResolvedValue({});
      await ChaptersTool.sort.put({ domain: 'global' }, { mode: 'DESCENDING', progressPercent: 50 });
      expect(mockPrefsPut).toHaveBeenCalledWith({
        key: 'global',
        value: JSON.stringify({ mode: 'DESCENDING', progressPercent: 50 }),
        domain: 'chapterSortPrefs',
      });
    });

    it('writes to the seriesId key when domain is "series"', async () => {
      mockPrefsPut.mockResolvedValue({});
      await ChaptersTool.sort.put({ domain: 'series', seriesId: 's1' }, { mode: 'AUTO_FIXED', fixedThreshold: 3, progressPercent: 50 });
      expect(mockPrefsPut).toHaveBeenCalledWith({
        key: 's1',
        value: JSON.stringify({ mode: 'AUTO_FIXED', fixedThreshold: 3, progressPercent: 50 }),
        domain: 'chapterSortPrefs',
      });
    });
  });

  describe('reset', () => {
    it('deletes the series override and returns the global default that now applies', async () => {
      mockPrefsDelete.mockResolvedValue(undefined);
      mockPrefsGet.mockResolvedValue({ value: JSON.stringify({ mode: 'DESCENDING', progressPercent: 50 }) });
      const result = await ChaptersTool.sort.reset({ seriesId: 's1' });
      expect(mockPrefsDelete).toHaveBeenCalledWith({ key: 's1' });
      expect(mockPrefsGet).toHaveBeenCalledWith({ key: 'global' });
      expect(result).toEqual({ mode: 'DESCENDING', progressPercent: 50 });
    });

    it('falls back to the hardcoded default when no global was ever saved either', async () => {
      mockPrefsDelete.mockResolvedValue(undefined);
      mockPrefsGet.mockResolvedValue(null);
      const result = await ChaptersTool.sort.reset({ seriesId: 's1' });
      expect(result).toEqual({ mode: 'ASCENDING', progressPercent: 50 });
    });
  });
});

describe('ChapterTool.format.date', () => {
  const t = getStrings('pt-BR');

  it('draws the chapter creation date in the chosen style', () => {
    expect(ChapterTool.format.date({ chapter: { createdUtc: '2026-11-08T15:00:00.000Z' }, style: 'YMD', language: 'pt-BR', t })).toMatch(/^2026-11-0[89]$/);
  });

  it('is undefined when the chapter has no usable date', () => {
    expect(ChapterTool.format.date({ chapter: {}, style: 'DMY', language: 'pt-BR', t })).toBeUndefined();
    expect(ChapterTool.format.date({ chapter: { createdUtc: '0001-01-01T00:00:00' }, style: 'DMY', language: 'pt-BR', t })).toBeUndefined();
  });
});

describe('ChaptersTool.dateStyle', () => {
  beforeEach(() => {
    mockPrefsGet.mockReset();
    mockPrefsPut.mockReset().mockResolvedValue(undefined);
  });

  it('reads a stored style', async () => {
    mockPrefsGet.mockResolvedValue({ value: 'MDY' });
    await expect(ChaptersTool.dateStyle.get()).resolves.toBe('MDY');
  });

  it('falls back to the language default when nothing valid is stored', async () => {
    mockPrefsGet.mockResolvedValueOnce(null);
    await expect(ChaptersTool.dateStyle.get()).resolves.toBe('LANGUAGE');
    mockPrefsGet.mockResolvedValueOnce({ value: 'nonsense' });
    await expect(ChaptersTool.dateStyle.get()).resolves.toBe('LANGUAGE');
    mockPrefsGet.mockRejectedValueOnce(new Error('boom'));
    await expect(ChaptersTool.dateStyle.get()).resolves.toBe('LANGUAGE');
  });

  it('writes the style under its own key and domain', async () => {
    await ChaptersTool.dateStyle.put({ style: 'YMD' });
    expect(mockPrefsPut).toHaveBeenCalledWith({ key: 'chapterDateStyle', value: 'YMD', domain: 'chapterDatePrefs' });
  });
});
