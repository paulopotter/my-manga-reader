import { Store } from './store.manager';

// HiddenContinueManager — the series the user hid from the Home's "continue reading" rail, a thin bind
// of Store to the `hiddenContinue` domain. Each one is remembered with the date it was last read when
// it was hidden: it stays hidden while that is still its last read date, and comes back on its own the
// moment it is read again (a newer date), wherever that happens.
//
// One record holds them all (the Home needs the whole set at once, and Store cannot list). The key is
// prefixed: Store entries share one keyspace, and a bare id could be a chapter's or a series' alike.

interface HiddenContinueValue {
  readDates: Record<string, number>;
}

const KEY = 'hidden-continue';

const domain = Store.for<HiddenContinueValue>({ domain: 'hiddenContinue' });

export const HiddenContinueManager = {
  // Series id → the last read date (epoch ms, 0 when never read) it had when it was hidden.
  async get(): Promise<Map<string, number>> {
    const record = await domain.get(KEY);
    return new Map(Object.entries(record?.readDates ?? {}));
  },

  async hide({ seriesId, readDateEpochMs }: { seriesId: string; readDateEpochMs: number }): Promise<void> {
    const record = await domain.get(KEY);
    await domain.set(KEY, { readDates: { ...(record?.readDates ?? {}), [seriesId]: readDateEpochMs } });
  },
};
