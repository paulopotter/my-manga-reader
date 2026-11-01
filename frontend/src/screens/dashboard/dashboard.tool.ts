import type { Strings } from '../../shared/i18n';
import { DateTool } from '../../shared/tools/date';
import { SerieTool, type Serie } from '../../shared/tools/serials';
import type { DashboardData, DashboardItem, DashboardStats, LocalProgress } from './dashboard.types';

// DashboardTool — pure functions that shape the Dashboard's rails from the series list the
// Library already loads (SerialsService.get → SeriesTool.normalize). Local to this screen: nothing
// else asks for these rails. No fetch, no cache — the hook feeds it.

export const DASHBOARD_LIMITS = {
  continueReading: 10,
  followedUpdated: 10,
  recentlyUpdated: 10,
  unfinished: 10,
  recentlyAdded: 10,
} as const;

// Digests fetched beyond the rail size, so a candidate that turns out to have nothing to resume
// (every chapter read) does not leave the rail short.
export const CONTINUE_CANDIDATE_BUFFER = 4;

// Kavita reports "never" as year 1, which reads as a huge negative epoch.
function validEpoch(ms: number | undefined): number | undefined {
  return ms != null && ms > 0 ? ms : undefined;
}

function chapterAddedOf(serie: Serie): number | undefined {
  return validEpoch(serie.lastUpdatesUTC?.chapterAdded);
}

function createdOf(serie: Serie): number | undefined {
  return validEpoch(serie.lastUpdatesUTC?.created);
}

function readDateOf(serie: Serie): number | undefined {
  return validEpoch(serie.lastUpdatesUTC?.readDate);
}

function isInProgress(serie: Serie): boolean {
  const pages = serie.pages;
  return pages != null && pages.read > 0 && pages.read < pages.total;
}

// A series the user hid from "continue reading" stays hidden while its last read date is still the one
// it had when hidden; reading it again makes that date newer, and it is back.
function isHidden({ serie, hidden }: { serie: Serie; hidden: ReadonlyMap<string, number> }): boolean {
  const hiddenAt = hidden.get(serie.id);
  return hiddenAt != null && (readDateOf(serie) ?? 0) <= hiddenAt;
}

const NOT_HIDDEN: ReadonlyMap<string, number> = new Map();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// How far into the chapter to resume the reader is. The server's count (pages read) can lag what the
// reader just did — a novel is one "page" whose position only the device keeps, and the progress of a
// comic reaches the server in batches — so the device's own record wins when it is the newer of the two.
function resumeFraction({
  pages,
  status,
  local,
}: {
  pages: { count?: number; readCount?: number; resumePoint?: { recordedAtEpochMs?: number } } | undefined;
  status: string;
  local: LocalProgress | undefined;
}): number | undefined {
  const count = pages?.count;
  if (pages == null || count == null || count <= 0) {return undefined;}
  const server = status === 'IN_PROGRESS' && (pages.readCount ?? 0) > 0 ? clamp01(pages.readCount! / count) : undefined;
  if (local == null) {return server;}
  const device = clamp01((local.page + local.scrollFraction) / count);
  const recordedByServer = pages.resumePoint?.recordedAtEpochMs ?? 0;
  return device > 0 && local.updatedAtEpochMs >= recordedByServer ? device : server;
}

function baseItem({ serie, t }: { serie: Serie; t: Strings }): DashboardItem {
  return { seriesId: serie.id, name: serie.name, coverUrl: serie.coverImage.url, badge: SerieTool.formatBadge({ fileFormat: serie.fileFormat, t }) };
}

function updatedCaption({ serie, t }: { serie: Serie; t: Strings }): string | undefined {
  const added = chapterAddedOf(serie);
  return added != null ? DateTool.format.to.relative(added, t) : undefined;
}

export const DashboardTool = {
  // When the series was last read (epoch ms), 0 when never — what "hide from continue reading" remembers.
  lastReadOf({ serie }: { serie: Serie }): number {
    return readDateOf(serie) ?? 0;
  },

  // The series worth fetching a digest for: started, not finished, most recently read first, and not
  // hidden by the user (`hidden`: series id → its last read date when hidden). Series-level pages are
  // all the list row carries, so a series whose pages are all read (and got a new chapter since) is not
  // seen here.
  continueCandidates({
    series,
    limit,
    hidden = NOT_HIDDEN,
  }: {
    series: Serie[];
    limit: number;
    hidden?: ReadonlyMap<string, number>;
  }): Serie[] {
    return series
      .filter(s => isInProgress(s) && !isHidden({ serie: s, hidden }))
      .sort((a, b) => (readDateOf(b) ?? 0) - (readDateOf(a) ?? 0))
      .slice(0, limit + CONTINUE_CANDIDATE_BUFFER);
  },

  // One "continue reading" tile from a series digest (it carries the resume point and each
  // chapter's page counts). Null when there is nothing left to resume.
  continueItem({ serie, t, local }: { serie: Serie; t: Strings; local?: LocalProgress }): DashboardItem | null {
    const resume = serie.resumePoint;
    if (!resume) {return null;}
    const chapter = serie.chapters.find(c => c.id === resume.stoppedAtChapterId);
    const number = chapter?.isSpecial ? chapter.specialLabel : (chapter?.decimalNumber ?? chapter?.number);
    const fraction = resumeFraction({ pages: chapter?.pages, status: resume.status, local });
    return {
      ...baseItem({ serie, t }),
      chapterId: resume.stoppedAtChapterId,
      caption: number != null ? t.dashboardChapter.replace('{0}', String(number)) : undefined,
      progressFraction: fraction,
      progressLabel: fraction != null ? t.dashboardPercentRead.replace('{0}', String(Math.round(fraction * 100))) : undefined,
    };
  },

  // What a "continue reading" tile is made of, as one string: two digests of the same series with
  // the same signature draw the same tile, so a reload that changed nothing can leave the screen alone.
  continueSignature(serie: Serie): string {
    const resume = serie.resumePoint;
    const chapter = resume ? serie.chapters.find(c => c.id === resume.stoppedAtChapterId) : undefined;
    return JSON.stringify([
      serie.id,
      serie.name,
      serie.coverImage.url,
      resume?.stoppedAtChapterId,
      resume?.status,
      chapter?.isSpecial,
      chapter?.specialLabel,
      chapter?.decimalNumber,
      chapter?.number,
      chapter?.pages?.count,
      chapter?.pages?.readCount,
    ]);
  },

  sameContinue({ previous, next }: { previous: Serie[]; next: Serie[] }): boolean {
    return (
      previous.length === next.length &&
      previous.every((serie, index) => DashboardTool.continueSignature(serie) === DashboardTool.continueSignature(next[index]))
    );
  },

  // The ids "continue reading" will show (its first `limit` candidates). The rails of things to do
  // leave them out — a series is on the Home once. Known from the list alone, so nothing moves when
  // the digests arrive.
  continueIds({ candidates, limit }: { candidates: Serie[]; limit: number }): Set<string> {
    return new Set(candidates.slice(0, limit).map(serie => serie.id));
  },

  // Followed series that got a chapter after the last time the user read them, newest first (plus a
  // buffer, since some will turn out to have nothing left to read). Series in `exclude` are left out.
  followedUpdatedCandidates({
    series,
    followedIds,
    exclude,
    limit,
  }: {
    series: Serie[];
    followedIds: Set<string>;
    exclude: Set<string>;
    limit: number;
  }): Serie[] {
    return series
      .filter(s => followedIds.has(s.id) && !exclude.has(s.id))
      .filter(s => {
        const added = chapterAddedOf(s);
        return added != null && added > (readDateOf(s) ?? 0);
      })
      .sort((a, b) => chapterAddedOf(b)! - chapterAddedOf(a)!)
      .slice(0, limit + CONTINUE_CANDIDATE_BUFFER);
  },

  // The "followed series updated" tiles. `digests` holds what is known of each candidate's own digest:
  // a digest says what is left to read (nothing left → the series is not shown, the point of this rail),
  // `null` means it could not be had (the tile stays, with the time of the update instead of a chapter),
  // and no entry means it is still on its way (the tile waits, so it never shows one thing and then another).
  followedUpdated({
    candidates,
    digests,
    exclude,
    limit,
    t,
  }: {
    candidates: Serie[];
    digests: Map<string, Serie | null>;
    exclude: Set<string>;
    limit: number;
    t: Strings;
  }): DashboardItem[] {
    const items: DashboardItem[] = [];
    for (const serie of candidates) {
      if (exclude.has(serie.id) || !digests.has(serie.id)) {continue;}
      const digest = digests.get(serie.id);
      if (digest == null) {
        items.push({ ...baseItem({ serie, t }), caption: updatedCaption({ serie, t }) });
        continue;
      }
      const resume = digest.resumePoint;
      if (!resume) {continue;}
      const chapter = digest.chapters.find(c => c.id === resume.stoppedAtChapterId);
      const number = chapter?.isSpecial ? chapter.specialLabel : (chapter?.decimalNumber ?? chapter?.number);
      items.push({
        ...baseItem({ serie, t }),
        caption: number != null ? t.dashboardNextChapter.replace('{0}', String(number)) : undefined,
      });
    }
    return items.slice(0, limit);
  },

  // Whether two sets of known candidate digests would draw the same tiles, so a reload that changed
  // nothing can leave the screen alone.
  sameDigests({ previous, next }: { previous: Map<string, Serie | null>; next: Map<string, Serie | null> }): boolean {
    if (previous.size !== next.size) {return false;}
    for (const [id, digest] of next) {
      if (!previous.has(id)) {return false;}
      const before = previous.get(id);
      if ((before == null) !== (digest == null)) {return false;}
      if (before != null && digest != null && DashboardTool.continueSignature(before) !== DashboardTool.continueSignature(digest)) {return false;}
    }
    return true;
  },

  recentlyUpdated({ series, limit, t }: { series: Serie[]; limit: number; t: Strings }): DashboardItem[] {
    return series
      .filter(s => chapterAddedOf(s) != null)
      .sort((a, b) => chapterAddedOf(b)! - chapterAddedOf(a)!)
      .slice(0, limit)
      .map(s => ({ ...baseItem({ serie: s, t }), caption: updatedCaption({ serie: s, t }) }));
  },

  // The series that are started and not finished (any series, followed or not), most recently read
  // first, that "continue reading" does not already own. A hidden one is not here either: it would only
  // turn up in this rail the moment it left the other.
  unfinishedCandidates({
    series,
    exclude,
    limit,
    hidden = NOT_HIDDEN,
  }: {
    series: Serie[];
    exclude: Set<string>;
    limit: number;
    hidden?: ReadonlyMap<string, number>;
  }): Serie[] {
    return series
      .filter(s => !exclude.has(s.id) && isInProgress(s) && !isHidden({ serie: s, hidden }))
      .sort((a, b) => (readDateOf(b) ?? 0) - (readDateOf(a) ?? 0))
      .slice(0, limit);
  },

  unfinished({
    series,
    exclude,
    limit,
    hidden,
    t,
  }: {
    series: Serie[];
    exclude: Set<string>;
    limit: number;
    hidden?: ReadonlyMap<string, number>;
    t: Strings;
  }): DashboardItem[] {
    return DashboardTool.unfinishedCandidates({ series, exclude, limit, hidden }).map(s => {
      const fraction = clamp01(s.pages!.read / s.pages!.total);
      return {
        ...baseItem({ serie: s, t }),
        caption: t.dashboardPercentRead.replace('{0}', String(Math.round(fraction * 100))),
        progressFraction: fraction > 0 ? fraction : undefined,
      };
    });
  },

  // What the rails above "followed series updated" own, known from the list alone (so nothing moves when
  // digests arrive): "continue reading"'s series and the ones "not finished yet" lists. A series is on the
  // Home once, and the one that is started and unfinished belongs to those rails, not to this one.
  followedOwners({
    series,
    continueIds,
    hidden,
  }: {
    series: Serie[];
    continueIds: Set<string>;
    hidden?: ReadonlyMap<string, number>;
  }): Set<string> {
    const owners = new Set(continueIds);
    DashboardTool.unfinishedCandidates({ series, exclude: continueIds, limit: DASHBOARD_LIMITS.unfinished, hidden }).forEach(s => owners.add(s.id));
    return owners;
  },

  // Series that appeared in the library most recently (not "got a chapter" — that is
  // recentlyUpdated).
  recentlyAdded({ series, limit, t }: { series: Serie[]; limit: number; t: Strings }): DashboardItem[] {
    return series
      .filter(s => createdOf(s) != null)
      .sort((a, b) => createdOf(b)! - createdOf(a)!)
      .slice(0, limit)
      .map(s => ({ ...baseItem({ serie: s, t }), caption: DateTool.format.to.relative(createdOf(s)!, t) }));
  },

  stats({ series, followedIds }: { series: Serie[]; followedIds: Set<string> }): DashboardStats {
    return {
      series: series.length,
      followed: series.filter(s => followedIds.has(s.id)).length,
      inProgress: series.filter(isInProgress).length,
    };
  },

  // `continueSeries` are the digests of DashboardTool.continueCandidates, already fetched;
  // `continueIds` is DashboardTool.continueIds; `followedDigests` what is known of the digests of
  // DashboardTool.followedUpdatedCandidates (see followedUpdated).
  build({
    series,
    followedIds,
    continueSeries,
    continueIds,
    followedDigests,
    localProgress,
    hidden,
    t,
  }: {
    series: Serie[];
    followedIds: Set<string>;
    continueSeries: Serie[];
    continueIds: Set<string>;
    followedDigests: Map<string, Serie | null>;
    // The device's own reading positions, by chapter id.
    localProgress: Map<string, LocalProgress>;
    // Series the user hid from "continue reading", by id → last read date when hidden.
    hidden?: ReadonlyMap<string, number>;
    t: Strings;
  }): DashboardData {
    const continueReading = continueSeries
      .map(serie => DashboardTool.continueItem({ serie, t, local: localProgress.get(serie.resumePoint?.stoppedAtChapterId ?? '') }))
      .filter((item): item is DashboardItem => item != null)
      .slice(0, DASHBOARD_LIMITS.continueReading);
    // What "continue reading" owns or shows is not repeated in the rails below it, and the series that
    // are started and unfinished stay out of "followed series updated" (see followedOwners). The
    // candidates are chosen with the owners known up front (the hook fetches exactly those); a series
    // that turns out to be shown by "continue reading" after all (promoted from beyond its limit) is
    // dropped later.
    const shown = new Set(continueIds);
    continueReading.forEach(item => shown.add(item.seriesId));
    const owners = DashboardTool.followedOwners({ series, continueIds, hidden });
    const candidates = DashboardTool.followedUpdatedCandidates({
      series,
      followedIds,
      exclude: owners,
      limit: DASHBOARD_LIMITS.followedUpdated,
    });
    const followedUpdated = DashboardTool.followedUpdated({
      candidates,
      digests: followedDigests,
      exclude: new Set([...shown, ...owners]),
      limit: DASHBOARD_LIMITS.followedUpdated,
      t,
    });
    return {
      continueReading,
      followedUpdated,
      unfinished: DashboardTool.unfinished({ series, exclude: shown, limit: DASHBOARD_LIMITS.unfinished, hidden, t }),
      recentlyUpdated: DashboardTool.recentlyUpdated({ series, limit: DASHBOARD_LIMITS.recentlyUpdated, t }),
      recentlyAdded: DashboardTool.recentlyAdded({ series, limit: DASHBOARD_LIMITS.recentlyAdded, t }),
      stats: DashboardTool.stats({ series, followedIds }),
    };
  },
};
