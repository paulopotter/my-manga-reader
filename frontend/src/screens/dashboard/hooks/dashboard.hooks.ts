import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { SerialDigest } from '../../../shared/bridge';
import { useAdultFiltered } from '../../../shared/context/adult-filter';
import { useStrings } from '../../../shared/i18n';
import { useEvent } from '../../../shared/managers/events';
import { FollowedSeriesService } from '../../../shared/services/followed-series';
import { HiddenContinueManager, ReadingProgressManager } from '../../../shared/managers/store';
import { SerialService, SerialsService } from '../../../shared/services/serials';
import { ConcurrencyTool } from '../../../shared/tools/concurrency';
import { SeriesTool, SerieEvents, SerieTool, type Serie } from '../../../shared/tools/serials';
import { DASHBOARD_LIMITS, DashboardTool } from '../dashboard.tool';
import type { DashboardData, DashboardItem, DashboardStatus, LocalProgress } from '../dashboard.types';

// How many "continue reading" digests are fetched at once. Each is a whole series (all its chapters),
// so asking for a dozen together makes every one of them slow and the first tile the last to appear.
const CONTINUE_DIGEST_CONCURRENCY = 4;

interface Source {
  series: Serie[];
  followedIds: Set<string>;
  continueSeries: Serie[];
  // The series "continue reading" owns (known from the list), which the rails of things to do leave out.
  continueIds: Set<string>;
  // What is known of the digests of the "followed series updated" candidates: a digest, null when it
  // could not be had, no entry while it is on its way.
  followedDigests: Map<string, Serie | null>;
}

function sameHidden({ previous, next }: { previous: Map<string, number>; next: Map<string, number> }): boolean {
  return previous.size === next.size && [...next].every(([id, date]) => previous.get(id) === date);
}

type DigestTask = { kind: 'continue'; serie: Serie; index: number } | { kind: 'followed'; serie: Serie };

// useDashboard — loads the series list (cache-first, the same call the Library makes), the
// followed ids, and a digest for each "continue reading" candidate, then hands them to
// DashboardTool. It owns no cache: keeping a series' resume point fresh is the series domain's job
// (SerialRefreshTool), not this screen's.
// Reloads (cache-first, cheap) every time the tab regains focus, so progress made elsewhere shows
// up, and again when SerialRefreshTool reports a series was re-fetched after reading;
// pull-to-refresh is the only `force` here.
//
// The screen paints as soon as the series list is in: every rail but "continue reading" is built from
// the list alone, and the digests that rail needs can take seconds (a cold or very long series), so
// nothing else waits for them. Its tiles appear one by one as each digest arrives.
//
// What it loads stays raw. The adult-content filter runs at read time over that source, before the
// rails are built — so a hidden series is absent from every rail and from the stats alike.
export function useDashboard() {
  const t = useStrings();
  const [status, setStatus] = useState<DashboardStatus>('loading');
  const [source, setSource] = useState<Source | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The tiles of a rail are still being fetched and none is on screen yet.
  const [continueLoading, setContinueLoading] = useState(false);
  const [followedLoading, setFollowedLoading] = useState(false);
  // The series the user hid from "continue reading", by id → its last read date when hidden.
  const [hidden, setHidden] = useState<Map<string, number>>(new Map());
  // Where the reader got to in each tile's chapter, as the device saved it: the server's count lags it.
  const [localProgress, setLocalProgress] = useState<Map<string, LocalProgress>>(new Map());
  // What the rails show right now, so a reload starts from it instead of from nothing.
  const shownContinueRef = useRef<Serie[]>([]);
  const shownFollowedRef = useRef<Map<string, Serie | null>>(new Map());
  // Only the latest request may write state: focus and pull-to-refresh can overlap.
  const requestRef = useRef(0);

  // Reads the device's saved position of the chapter each "continue reading" tile would open.
  const readLocalProgress = useCallback(async (digests: Serie[]) => {
    const ids = digests.map(serie => serie.resumePoint?.stoppedAtChapterId).filter((id): id is string => id != null);
    const entries = await Promise.all(ids.map(async id => [id, await ReadingProgressManager.get(id).catch(() => null)] as const));
    const next = new Map<string, LocalProgress>();
    entries.forEach(([id, record]) => {
      if (record) {next.set(id, { page: record.page, scrollFraction: record.scrollFraction, updatedAtEpochMs: record.updatedAtEpochMs });}
    });
    setLocalProgress(previous => {
      const same =
        previous.size === next.size &&
        [...next].every(([id, value]) => {
          const before = previous.get(id);
          return before != null && before.page === value.page && before.scrollFraction === value.scrollFraction && before.updatedAtEpochMs === value.updatedAtEpochMs;
        });
      return same ? previous : next;
    });
  }, []);

  const load = useCallback(async ({ force }: { force: boolean }) => {
    const request = ++requestRef.current;
    const startedAt = Date.now();
    try {
      const [serialsDigest, followedIds, hiddenNow] = await Promise.all([
        SerialsService.get({ force }),
        FollowedSeriesService.ids.get().catch(() => [] as string[]),
        HiddenContinueManager.get().catch(() => new Map<string, number>()),
      ]);
      if (!serialsDigest.isSuccess) {
        throw new Error(serialsDigest.error.message ?? serialsDigest.error.code ?? 'serials digest failed');
      }
      const series = SeriesTool.normalize({ serials: serialsDigest.serials });
      const followed = new Set(followedIds);
      const listMs = Date.now() - startedAt;

      if (request !== requestRef.current) {return;}
      setHidden(previous => (sameHidden({ previous, next: hiddenNow }) ? previous : hiddenNow));
      const candidates = DashboardTool.continueCandidates({ series, limit: DASHBOARD_LIMITS.continueReading, hidden: hiddenNow });
      const continueIds = DashboardTool.continueIds({ candidates, limit: DASHBOARD_LIMITS.continueReading });
      const followedCandidates = DashboardTool.followedUpdatedCandidates({
        series,
        followedIds: followed,
        exclude: DashboardTool.followedOwners({ series, continueIds, hidden: hiddenNow }),
        limit: DASHBOARD_LIMITS.followedUpdated,
      });
      // Start from the digests already on screen: a reload only replaces a tile when its fresh digest
      // lands, so a rail never empties and refills (that was the flicker on every return to the tab).
      const shown = new Map(shownContinueRef.current.map(serie => [serie.id, serie]));
      const resolved: Array<Serie | null> = candidates.map(candidate => shown.get(candidate.id) ?? null);
      const digests = new Map<string, Serie | null>();
      followedCandidates.forEach(candidate => {
        if (shownFollowedRef.current.has(candidate.id)) {digests.set(candidate.id, shownFollowedRef.current.get(candidate.id) ?? null);}
      });
      const publish = () => {
        if (request !== requestRef.current) {return;}
        const next = resolved.filter((s): s is Serie => s != null);
        // Nothing the tiles show has changed: leave the screen alone.
        if (
          DashboardTool.sameContinue({ previous: shownContinueRef.current, next }) &&
          DashboardTool.sameDigests({ previous: shownFollowedRef.current, next: digests })
        ) {
          return;
        }
        shownContinueRef.current = next;
        shownFollowedRef.current = new Map(digests);
        setSource({ series, followedIds: followed, continueSeries: next, continueIds, followedDigests: new Map(digests) });
      };

      if (request !== requestRef.current) {return;}
      // Paint now, with what is already known for the rails that need a digest.
      shownContinueRef.current = resolved.filter((s): s is Serie => s != null);
      shownFollowedRef.current = new Map(digests);
      setSource({ series, followedIds: followed, continueSeries: shownContinueRef.current, continueIds, followedDigests: new Map(digests) });
      setStatus('ready');
      setContinueLoading(shownContinueRef.current.length === 0 && candidates.length > 0);
      setFollowedLoading(digests.size === 0 && followedCandidates.length > 0);
      readLocalProgress(shownContinueRef.current).catch(() => {});

      const tasks: DigestTask[] = [
        ...candidates.map((serie, index): DigestTask => ({ kind: 'continue', serie, index })),
        ...followedCandidates.map((serie): DigestTask => ({ kind: 'followed', serie })),
      ];
      await ConcurrencyTool.each({
        items: tasks,
        limit: CONTINUE_DIGEST_CONCURRENCY,
        task: async task => {
          let digest: SerialDigest | null = null;
          try {
            digest = await SerialService.get({ seriesId: task.serie.id, force });
          } catch {
            digest = null;
          }
          const serie = digest?.isSuccess ? SerieTool.normalize.digest({ digest }) : null;
          if (task.kind === 'continue') {
            if (serie) {resolved[task.index] = serie;}
          } else {
            digests.set(task.serie.id, serie);
          }
          publish();
        },
      });
      if (request === requestRef.current) {
        setContinueLoading(false);
        setFollowedLoading(false);
        await readLocalProgress(shownContinueRef.current).catch(() => {});
      }
      // One line per load, so a slow open can be told apart on the device: the list, or the digests.
      console.log(`[dashboard] list=${listMs}ms digests=${Date.now() - startedAt - listMs}ms candidates=${candidates.length} force=${force}`);
    } catch {
      if (request !== requestRef.current) {return;}
      setContinueLoading(false);
      setFollowedLoading(false);
      // A reload that fails keeps what is already on screen.
      setStatus(previous => (previous === 'ready' ? 'ready' : 'error'));
    }
  }, [readLocalProgress]);

  useFocusEffect(
    useCallback(() => {
      load({ force: false });
    }, [load]),
  );

  // A series was re-fetched after reading in it: re-read the (now fresh) cache.
  useEvent(SerieEvents.refreshed, () => {
    load({ force: false });
  });

  // Adult filter at read time. The series that survive it are the only ones any rail can see;
  // the continue-reading digests are narrowed to the same set.
  const visibleSeries = useAdultFiltered({ items: source?.series ?? [], idOf: serie => serie.id });
  const data = useMemo<DashboardData | null>(() => {
    if (!source) {return null;}
    const visibleIds = new Set(visibleSeries.map(serie => serie.id));
    const blurredIds = new Set(visibleSeries.filter(serie => serie.blurred).map(serie => serie.id));
    const built = DashboardTool.build({
      series: visibleSeries,
      followedIds: source.followedIds,
      continueSeries: source.continueSeries.filter(serie => visibleIds.has(serie.id)),
      continueIds: source.continueIds,
      followedDigests: source.followedDigests,
      localProgress,
      hidden,
      t,
    });
    const mark = (items: DashboardItem[]): DashboardItem[] =>
      items.map(item => (blurredIds.has(item.seriesId) ? { ...item, blurred: true } : item));
    return {
      ...built,
      continueReading: mark(built.continueReading),
      followedUpdated: mark(built.followedUpdated),
      recentlyUpdated: mark(built.recentlyUpdated),
      unfinished: mark(built.unfinished),
      recentlyAdded: mark(built.recentlyAdded),
    };
  }, [source, visibleSeries, localProgress, hidden, t]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ force: true });
    setRefreshing(false);
  }, [load]);

  // Hides a series from "continue reading" until it is read again, then reloads (cache-first) so the
  // rails drop it at once. Remembers its last read date: a newer one is what brings it back.
  const hideContinue = useCallback(
    async ({ seriesId }: { seriesId: string }) => {
      const serie = source?.series.find(s => s.id === seriesId);
      if (!serie) {return;}
      try {
        await HiddenContinueManager.hide({ seriesId, readDateEpochMs: DashboardTool.lastReadOf({ serie }) });
      } catch {
        return;
      }
      await load({ force: false });
    },
    [source, load],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    load({ force: false });
  }, [load]);

  return { status, data, refreshing, continueLoading, followedLoading, refresh, retry, hideContinue };
}
