jest.mock('../caches/cache.manager', () => ({
  CacheManager: {
    persistent: { get: jest.fn(), put: jest.fn(), invalidate: jest.fn() },
  },
}));

import { CacheManager } from '../caches/cache.manager';
import { HiddenContinueManager } from './hidden-continue.store';
import { ReadingProgressManager } from './reading-progress.store';
import { Store } from './store.manager';

const mockGet = CacheManager.persistent.get as jest.Mock;
const mockPut = CacheManager.persistent.put as jest.Mock;
const mockInvalidate = CacheManager.persistent.invalidate as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockResolvedValue({});
  mockInvalidate.mockResolvedValue(undefined);
});

describe('Store.for', () => {
  interface Sample {
    a: string;
    n: number;
  }
  const sample = Store.for<Sample>({ domain: 'sample' });

  describe('get', () => {
    it('returns null when the cache has no entry', async () => {
      mockGet.mockResolvedValue(null);
      expect(await sample.get('k1')).toBeNull();
      expect(mockGet).toHaveBeenCalledWith({ key: 'k1', variant: '' });
    });

    it('parses the value and folds in cachedAtEpochMs as updatedAtEpochMs', async () => {
      mockGet.mockResolvedValue({
        value: JSON.stringify({ a: 'x', n: 3 }),
        cachedAtEpochMs: 1_700_000,
        ttlMs: 0,
        isExpired: false,
      });
      expect(await sample.get('k1')).toEqual({ a: 'x', n: 3, updatedAtEpochMs: 1_700_000 });
    });

    it('returns null when the stored value is not valid JSON', async () => {
      mockGet.mockResolvedValue({ value: 'not json', cachedAtEpochMs: 1, ttlMs: 0, isExpired: false });
      expect(await sample.get('k1')).toBeNull();
    });
  });

  describe('set', () => {
    it('writes the JSON value under the given domain', async () => {
      await sample.set('k1', { a: 'y', n: 7 });
      expect(mockPut).toHaveBeenCalledWith({
        key: 'k1',
        value: JSON.stringify({ a: 'y', n: 7 }),
        domain: 'sample',
        variant: '',
      });
    });

    it('resolves to undefined (not the descriptor)', async () => {
      mockPut.mockResolvedValue({ key: 'k1', cachedAtEpochMs: 1 });
      expect(await sample.set('k1', { a: 'z', n: 0 })).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('invalidates the entry by key', async () => {
      await sample.clear('k1');
      expect(mockInvalidate).toHaveBeenCalledWith({ key: 'k1', variant: '' });
    });
  });

  it('scopes writes by domain — two domains never share a write', async () => {
    const other = Store.for<Sample>({ domain: 'other' });
    await sample.set('k', { a: 'a', n: 1 });
    await other.set('k', { a: 'b', n: 2 });
    expect(mockPut).toHaveBeenNthCalledWith(1, expect.objectContaining({ domain: 'sample' }));
    expect(mockPut).toHaveBeenNthCalledWith(2, expect.objectContaining({ domain: 'other' }));
  });
});

describe('ReadingProgressManager (Store bound to the readingProgress domain)', () => {
  describe('get', () => {
    it('returns null when the cache has no entry', async () => {
      mockGet.mockResolvedValue(null);
      expect(await ReadingProgressManager.get('c1')).toBeNull();
      expect(mockGet).toHaveBeenCalledWith({ key: 'c1', variant: '' });
    });

    it('parses the value and folds in the cache timestamp as updatedAtEpochMs', async () => {
      mockGet.mockResolvedValue({
        value: JSON.stringify({ seriesId: 's1', page: 12, scrollFraction: 0.4 }),
        cachedAtEpochMs: 1_700_000,
        ttlMs: 0,
        isExpired: false,
      });
      expect(await ReadingProgressManager.get('c1')).toEqual({
        seriesId: 's1', page: 12, scrollFraction: 0.4, updatedAtEpochMs: 1_700_000,
      });
    });

    it('returns null when the stored value is not valid JSON', async () => {
      mockGet.mockResolvedValue({ value: 'not json', cachedAtEpochMs: 1, ttlMs: 0, isExpired: false });
      expect(await ReadingProgressManager.get('c1')).toBeNull();
    });
  });

  describe('set', () => {
    it('writes the JSON value under the readingProgress domain', async () => {
      await ReadingProgressManager.set('c1', { seriesId: 's1', page: 7, scrollFraction: 0.1 });
      expect(mockPut).toHaveBeenCalledWith({
        key: 'c1',
        value: JSON.stringify({ seriesId: 's1', page: 7, scrollFraction: 0.1 }),
        domain: 'readingProgress',
        variant: '',
      });
    });

    it('resolves to undefined (not the descriptor)', async () => {
      mockPut.mockResolvedValue({ key: 'c1', cachedAtEpochMs: 1 });
      expect(await ReadingProgressManager.set('c1', { seriesId: 's1', page: 1, scrollFraction: 0 })).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('invalidates the entry by key', async () => {
      await ReadingProgressManager.clear('c1');
      expect(mockInvalidate).toHaveBeenCalledWith({ key: 'c1', variant: '' });
    });
  });
});

describe('HiddenContinueManager (Store bound to the hiddenContinue domain)', () => {
  const stored = (readDates: Record<string, number>) => ({
    value: JSON.stringify({ readDates }),
    cachedAtEpochMs: 1,
    ttlMs: 0,
    isExpired: false,
  });

  it('is empty when nothing was ever hidden', async () => {
    mockGet.mockResolvedValue(null);
    expect((await HiddenContinueManager.get()).size).toBe(0);
    expect(mockGet).toHaveBeenCalledWith({ key: 'hidden-continue', variant: '' });
  });

  it('reads each hidden series with the read date it had when hidden', async () => {
    mockGet.mockResolvedValue(stored({ '7': 1_000, '9': 0 }));
    expect(await HiddenContinueManager.get()).toEqual(new Map([['7', 1_000], ['9', 0]]));
  });

  it('hides a series by adding it to the one record, keeping the ones already hidden', async () => {
    mockGet.mockResolvedValue(stored({ '7': 1_000 }));
    await HiddenContinueManager.hide({ seriesId: '9', readDateEpochMs: 2_000 });
    expect(mockPut).toHaveBeenCalledWith({
      key: 'hidden-continue',
      value: JSON.stringify({ readDates: { '7': 1_000, '9': 2_000 } }),
      domain: 'hiddenContinue',
      variant: '',
    });
  });

  it('starts the record when nothing was hidden yet', async () => {
    mockGet.mockResolvedValue(null);
    await HiddenContinueManager.hide({ seriesId: '9', readDateEpochMs: 2_000 });
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({ value: JSON.stringify({ readDates: { '9': 2_000 } }) }),
    );
  });

  it('hiding a series again replaces the date it was hidden at', async () => {
    mockGet.mockResolvedValue(stored({ '7': 1_000 }));
    await HiddenContinueManager.hide({ seriesId: '7', readDateEpochMs: 5_000 });
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({ value: JSON.stringify({ readDates: { '7': 5_000 } }) }),
    );
  });
});
