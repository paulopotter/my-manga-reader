// Reader V2 — pure screen-local model for the CHAPTER shape the reader works with. No I/O, no
// React, no hooks — every function here is directly unit-testable. This is the reader's own
// "chapter in reader context" logic: turning a digest into a ReaderChapter, resolving the
// series-order number, read-state helpers. It lives here (not in the shared ChapterTool) because
// only the reader consumes it — per architecture.md § "No Transform layer", pure derivation that
// only one screen has and no other domain reuses is a screen-local model file, not a Tool.
//
// The window-shape logic (buildWindow / computeWindowAfterFocusMove / …) is a separate concern —
// see reader.window.ts.

import type {
  ChapterDigestSuccess,
  ChapterNeighborDigestSuccess,
} from '../../shared/bridge';
import type { OrderedChapter, ReaderChapter } from './reader.types';

// "Practically finished" cutoff — used both for auto-mark-as-read while scrolling
// (chapterFraction >= this) and for isChapterEffectivelyRead (pagesRead / pageCount >= this).
// 0.95, not 0.98: chapterFraction measures the viewport's bottom edge against the chapter's
// total pixel height, so the last ~1 viewport of a chapter never counts (there's nothing below
// to scroll it past). On a webtoon whose final page is many thousands of px tall, 0.98 means
// the user has to drag through almost the entire last page before it marks — they routinely
// reach the visible end and stop with the fraction stuck around 0.95-0.97. 0.95 marks it when
// they've genuinely seen the chapter through. (device log v40/v41: fraction climbs past 0.98
// only in the final few hundred px of an ~19000px last page.)
export const READ_THRESHOLD_FRACTION = 0.95;

// ── digest → ReaderChapter ───────────────────────────────────────────────

export function chapterFromDigest(
  digest: ChapterDigestSuccess | ChapterNeighborDigestSuccess,
): ReaderChapter {
  const list = digest.pages.list;
  return {
    id: digest.id,
    seriesId: digest.seriesId,
    number: digest.number,
    decimalNumber: digest.decimalNumber,
    specialLabel: digest.specialLabel,
    isSpecial: digest.isSpecial,
    title: digest.title,
    readStatus: digest.readStatus,
    pageCount: digest.pages.count ?? list.length,
    pagesRead: digest.pages.readCount ?? 0,
    pageUrls: list.map(p => (p.isSuccess ? p.url : '')),
    pageAspectRatios: list.map(p =>
      p.isSuccess && p.width && p.height && p.width > 0 ? p.height / p.width : null,
    ),
    serverResume:
      digest.pages.resumePoint?.stoppedAtPageIndex != null
        ? {
            page: digest.pages.resumePoint.stoppedAtPageIndex,
            recordedAtEpochMs: digest.pages.resumePoint.recordedAtEpochMs ?? null,
          }
        : null,
  };
}

// A placeholder chapter from the series-order list alone — no pages yet, filled by a getFull.
export function placeholderChapterFromOrder(o: OrderedChapter): ReaderChapter {
  return {
    id: o.id,
    seriesId: o.seriesId,
    number: o.number,
    decimalNumber: o.decimalNumber,
    specialLabel: o.specialLabel,
    isSpecial: o.isSpecial,
    title: o.title,
    readStatus: o.readStatus,
    pageCount: 0,
    pagesRead: 0,
    pageUrls: [],
    pageAspectRatios: [],
    serverResume: null,
  };
}

// The chapter's `number` from the series order (SerialDigest.chapters.list, 1-indexed position) —
// the SAME value the series screen shows. ChapterService.getFull called in isolation gives a
// DIFFERENT `number` (decimalNumber truncated), so anywhere the reader shows "Capítulo N" it must
// use this. Falls back to the chapter's own number when the order isn't loaded / the chapter
// isn't in it.
export function withOrderNumber(c: ReaderChapter, order: OrderedChapter[]): ReaderChapter {
  const o = order.find(x => x.id === c.id);
  return o && o.number != null && o.number !== c.number ? { ...c, number: o.number } : c;
}

// ── read-status helpers ─────────────────────────────────────────────────

export function isChapterEffectivelyRead(c: ReaderChapter): boolean {
  if (c.readStatus === 'READ') {return true;}
  if (c.pageCount <= 0) {return false;}
  return c.pagesRead / c.pageCount >= READ_THRESHOLD_FRACTION;
}

// Where to open the chapter. Priority (see _freshness-principles.md — timestamps are the
// tiebreaker, not source priority):
//  1. Effectively read → page 0 ("marking it read means 'reread from the start'").
//  2. Otherwise local progress vs. the server resume point compete by timestamp — newest wins.
//     A local record with no server timestamp wins; a server point with no local record wins.
//  3. Nothing → page 0.
export function resolveInitialPage(
  c: ReaderChapter,
  local: { page: number; scrollFraction: number; updatedAtEpochMs: number } | null,
): { page: number; scrollFraction: number } {
  if (isChapterEffectivelyRead(c)) {return { page: 0, scrollFraction: 0 };}

  const server = c.serverResume;
  if (local && server) {
    const localWins =
      server.recordedAtEpochMs == null || local.updatedAtEpochMs >= server.recordedAtEpochMs;
    return localWins
      ? { page: local.page, scrollFraction: local.scrollFraction }
      : { page: server.page, scrollFraction: 0 };
  }
  if (local) {return { page: local.page, scrollFraction: local.scrollFraction };}
  if (server) {return { page: server.page, scrollFraction: 0 };}
  return { page: 0, scrollFraction: 0 };
}

export function shouldUnmarkOnReread(
  wasReadOnOpen: boolean,
  currentPage: number,
  totalPages: number,
  alreadyUnmarkedThisSession: boolean,
): boolean {
  if (!wasReadOnOpen || alreadyUnmarkedThisSession) {return false;}
  return currentPage < totalPages - 1;
}

// ── series order ────────────────────────────────────────────────────────

// Moved to shared/tools/chapters (the book reader is the second consumer); re-exported here so the
// reader keeps importing them from its own model.
export { toOrderedChapters, neighborsOfIn, adjacentChapterId } from '../../shared/tools/chapters/chapters-order.tool';

// Where the chapter sits in the series, 1-indexed for display — null while the order isn't loaded or
// doesn't hold the chapter, where a "1 de 1" would say nothing true. Position, not `chapter.number`:
// a series with specials or gaps in its numbering still counts 1..N.
export function chapterPosition(
  order: OrderedChapter[],
  chapterId: string,
): { position: number; total: number } | null {
  const index = order.findIndex(c => c.id === chapterId);
  return index === -1 ? null : { position: index + 1, total: order.length };
}

// ── progress bar ────────────────────────────────────────────────────────

export function progressBarFraction(chapterFraction: number): number {
  return Math.min(1, Math.max(0, chapterFraction));
}
