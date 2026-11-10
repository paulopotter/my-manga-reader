import { createNavigateAction, type ActionContract } from '../actions';
import { Routes } from '../../../navigation/routes';
import { ChapterService } from '../../services/chapters';
import { EventBus, EventsManager, createEvent } from '../../managers/events';
import type { ContentEvent } from '../../managers/events';
import { NotificationEvents } from '../../services/notifications';
import { PreferencesManager } from '../../managers/preferences';
import type { Strings } from '../../i18n';
import { DateTool, DATE_STYLES, type DateStyle } from '../date';
import type { ChapterDigestSuccess, ChapterReadStatus, ImageDescriptor, ServerActiveInfo } from '../../bridge';

// ChapterTool — normalizer/facade for the "chapter" domain: turns a ChapterDigestSuccess into the
// canonical shape SerieTool (and any future caller) reads, plus the read/unread/toggle mark
// actions. Absorbed here, not inside serie.tool.ts — normalizing/marking a chapter is chapter's
// own concern (Domain Composition: Series delegates downward to Chapter).

export interface ChapterMarkUpdate {
  seriesId: string;
  chapterId: string;
  readStatus: ChapterReadStatus;
}

// ── ChapterEvents — EventBus tokens this module emits (plano 017, Task 013) ─────────────────
// Declared here, next to the emitter (ChapterTool.mark.*), per Task 013: an event lives with
// whichever module raises it. A listener imports `ChapterEvents.x` (autocomplete, no typo) and
// never writes the event-name string. The bus imposes no shared payload shape — this one is
// chapter's own.

// `phase` maps ChapterTool.mark.*'s optimistic/confirm/revert flow: the tool emits once
// immediately ('optimistic'), then again when ChapterService.status.set resolves ('confirmed')
// or rejects ('reverted' — readStatus is then the value it fell back to). A listener that only
// cares about the visible outcome can act on 'optimistic' + 'reverted' and ignore 'confirmed'.
//
// `changed.prevStatus` is the chapter's status right before this change, when the caller knew it:
// mark.toggle always supplies it (it reads the digest first); mark.read/unread carry it only when
// their own caller passed `prevStatus`. A listener keeping a running aggregate (e.g. the Library's
// readChapters count) uses it to decide whether this change actually crosses the READ boundary
// (prev !== 'READ' && next === 'READ' → +1, and the mirror for −1); when it's absent, the
// listener falls back to an optimistic ±1 with a clamp and lets a background refetch reconcile.
export interface ChapterReadStatusChangedPayload {
  chapter: { id: string; seriesId: string };
  changed: { readStatus: ChapterReadStatus; prevStatus?: ChapterReadStatus };
  phase: 'optimistic' | 'confirmed' | 'reverted';
}

export const ChapterEvents = {
  readStatusChanged: createEvent<ChapterReadStatusChangedPayload>('chapterReadStatusChanged'),
} as const;

function emitReadStatusChanged(
  update: ChapterMarkUpdate,
  phase: ChapterReadStatusChangedPayload['phase'],
  prevStatus?: ChapterReadStatus,
): void {
  EventBus.emit(ChapterEvents.readStatusChanged, {
    chapter: { id: update.chapterId, seriesId: update.seriesId },
    changed: { readStatus: update.readStatus, prevStatus },
    phase,
  });
}

// Shared body of ChapterTool.mark.readMany / unreadMany — see readMany's doc. One
// ChapterService.status.setMany for the whole list; optimistic/confirm/revert applied per id.
//
// `onUpdateMany` (batch) vs `onUpdate` (per-id, inherited from the single-chapter mark contract):
// a caller applying N updates to React state via `onUpdate` in this file's own forEach loops was
// triggering one setState per chapter — O(N²) work (each setState re-copies the caller's whole
// chapter array) that showed up as a UI freeze marking large selections read. `onUpdateMany` gives
// a caller like SerieScreen a single callback with the whole batch, so it can fold all N changes
// into one setState. `emitReadStatusChanged` still fires once per id — other screens/listeners
// (Library, EventBus) still need one event per chapter; only the LOCAL React-state channel batches.
function markMany(
  {
    seriesId,
    chapterIds,
    prevStatusById,
    onUpdate,
    onUpdateMany,
  }: {
    seriesId: string;
    chapterIds: string[];
    prevStatusById?: Record<string, ChapterReadStatus>;
    onUpdate?: (update: ChapterMarkUpdate) => void;
    onUpdateMany?: (updates: ChapterMarkUpdate[]) => void;
  },
  isRead: boolean,
): Promise<ChapterMarkUpdate[]> {
  const targetStatus: ChapterReadStatus = isRead ? 'READ' : 'UNREAD';
  const fallbackStatus: ChapterReadStatus = isRead ? 'UNREAD' : 'READ';
  const optimistic: ChapterMarkUpdate[] = chapterIds.map(chapterId => ({
    seriesId,
    chapterId,
    readStatus: targetStatus,
  }));

  onUpdateMany?.(optimistic);
  optimistic.forEach(update => {
    onUpdate?.(update);
    emitReadStatusChanged(update, 'optimistic', prevStatusById?.[update.chapterId]);
  });

  ChapterService.status
    .setMany({ seriesId, chapterIds, isRead })
    .then(() => {
      onUpdateMany?.(optimistic);
      optimistic.forEach(update => {
        onUpdate?.(update);
        emitReadStatusChanged(update, 'confirmed', prevStatusById?.[update.chapterId]);
      });
    })
    .catch(() => {
      const reverted: ChapterMarkUpdate[] = chapterIds.map(chapterId => ({
        seriesId,
        chapterId,
        readStatus: prevStatusById?.[chapterId] ?? fallbackStatus,
      }));
      onUpdateMany?.(reverted);
      reverted.forEach(update => {
        onUpdate?.(update);
        // From an aggregate listener's POV the "previous" state is the optimistic one it already
        // applied — so it can undo exactly that.
        emitReadStatusChanged(update, 'reverted', targetStatus);
      });
    });

  return Promise.resolve(optimistic);
}

// Raw chapter fields needed to compose the displayed label. Own interface (not Pick<SerieChapter>)
// so any shape carrying these raw fields — SerieChapter, the reader screen's ReaderChapter, or a
// future one — is structurally compatible.
export interface ChapterTitleFields {
  title: string;
  number?: number;
  decimalNumber?: number;
  specialLabel?: string;
  isSpecial?: boolean;
}

// Deliberately duplicated from ChapterDigestSuccess (bridge/digest.ts) instead of re-exporting it:
// this is a normalizer's own contract, free to evolve independently of whatever shape the raw
// digest happens to have.
export interface SerieChapter {
  id: string;
  seriesId: string;
  decimalNumber?: number;
  number?: number;
  specialLabel?: string;
  isSpecial?: boolean;
  title: string;
  createdUtc?: string;
  coverImage: ImageDescriptor;
  readStatus: ChapterDigestSuccess['readStatus'];
  pages: ChapterDigestSuccess['pages'];
  resolvedAtEpochMs: number;
  server: ServerActiveInfo;
  action: ActionContract; // not present on ChapterDigestSuccess — added by this normalizer
  events: ChapterEventsContract; // likewise — see chapterEvents below
}

// What can happen to a chapter, as the chapter domain itself declares it. `opened` is armed on
// every normalized chapter (the normalizer can't know why it was called); only whoever actually
// opens one calls `exec`.
export interface ChapterEventsContract {
  opened: ContentEvent;
}

// The chapter domain's own event declaration, exposed so BOTH callers can reach it: normalize()
// (for a chapter that came from a digest) and the reader (which keeps its own screen-local
// projection — reader.model.ts, per architecture.md § "No Transform layer" — and so holds only
// the ids, never a SerieChapter). One definition, so the two can't drift.
export function chapterEvents({
  seriesId,
  chapterId,
}: {
  seriesId: string;
  chapterId: string;
}): ChapterEventsContract {
  const events = EventsManager.build({ domain: 'chapter', content: { seriesId, chapterId } });
  return {
    // Opening a chapter is also what "consumes" any notification announcing it — chained here
    // rather than in the reader, so every way of opening a chapter reports it the same way.
    ...events.opened({
      after: () =>
        EventBus.emit(NotificationEvents.contentConsumed, { content: { seriesId, chapterId } }),
    }),
  };
}

// Two channels, on purpose, one not replacing the other:
//  - `onUpdate` (callback param) — the LOCAL channel: the caller wires it to its own React state
//    (e.g. SerieScreen updating its chapter list in place). Every value — optimistic, confirmed,
//    reverted — flows through it. The returned Promise is a convenience for a caller that only
//    wants the immediate optimistic value without awaiting the network call.
//  - ChapterEvents.readStatusChanged (EventBus) — the CROSS-SCREEN channel: any part of the app
//    not in this component tree (e.g. the Library, mounted in the nav stack) reacts without the
//    emitter knowing it exists. Emitted at the same three moments, with the same `phase`.
//
// Reader (Task 029 Fase 2) now marks through this tool too, so a mark from the Reader also emits
// the event.
//
// KNOWN GAP — cache not invalidated after a mark. ChapterService.status.set writes to the server
// but the ChapterDigest / SeriesDigest entries in Cache.persistent (Kotlin) still hold the
// pre-mark readStatus until their TTL (~15min) expires. A screen that mounts AFTER the mark
// (e.g. the Reader opened from the series screen right after marking there) reads that stale
// cache. The EventBus covers screens already mounted; it does not cover this. A per-key
// invalidation was tried and reverted — invalidating by domain was too broad (dropped every
// series/chapter for one mark), and invalidating by key would couple RN to the Kotlin key
// format. The fix is a scoped invalidation/patch of exactly the two affected entries, its own
// task — and per the user's call it must live in RN, not Kotlin (Kotlin stays "dumb"). See
// _freshness-principles.md § "Consequences for open work".
export const ChapterTool = {
  // `origin` is navigation state, not domain data — useAction() merges it in at realize time,
  // this action never carries it.
  normalize({ chapter, seriesId }: { chapter: ChapterDigestSuccess; seriesId: string }): SerieChapter {
    return {
      id: chapter.id,
      seriesId: chapter.seriesId,
      decimalNumber: chapter.decimalNumber,
      number: chapter.number,
      specialLabel: chapter.specialLabel,
      isSpecial: chapter.isSpecial,
      title: chapter.title,
      createdUtc: chapter.createdUtc,
      coverImage: chapter.coverImage,
      readStatus: chapter.readStatus,
      pages: chapter.pages,
      resolvedAtEpochMs: chapter.resolvedAtEpochMs,
      server: chapter.server,
      action: createNavigateAction({ route: Routes.READER, params: { seriesId, chapterId: chapter.id } }),
      events: chapterEvents({ seriesId, chapterId: chapter.id }),
    };
  },

  format: {
    // Displayed label for a chapter, the single source of truth for how a chapter is named
    // anywhere in the app (the list, the "continue reading" button, …). Early-return cascade:
    //   1. a special's own label
    //   2. "<number>. <title>" when there's a REAL title — a title is not real when it's empty
    //      or it's just a number (int or decimal), regardless of which number: Kavita fills it
    //      with a bare number in many shapes ("6", "6.0", "06", "104" on chapter 105 via an
    //      off-by-one). Anything with a non-numeric char ("Chapter 6", "6: The Arrival") is real.
    //   3. "Capítulo <number>" (i18n)
    //   4. "Sem título" (i18n)
    // `t` is injected because this tool is pure — it has no language context of its own. Moved
    // here out of chapter-list-item.component.tsx (a dumb component holds no logic).
    title(chapter: ChapterTitleFields, t: Strings): string {
      if (chapter.isSpecial && chapter.specialLabel) {return chapter.specialLabel;}

      const num = chapter.number ?? chapter.decimalNumber;
      const trimmed = chapter.title.trim();
      const isJustANumber = trimmed.length === 0 || /^\d+(\.\d+)?$/.test(trimmed);

      if (!isJustANumber) {return num != null ? `${num}. ${trimmed}` : trimmed;}
      if (num != null) {return t.seriesDetailChapterNumberLabel.replace('{0}', String(num));}
      return t.seriesDetailChapterUntitled;
    },

    // The date shown beside a chapter's name: when the server registered it (`createdUtc`), drawn in
    // the shape the user chose. Undefined when the chapter has no usable date.
    date({ chapter, style, language, t }: { chapter: { createdUtc?: string }; style: DateStyle; language: string; t: Strings }): string | undefined {
      const epochMs = DateTool.parse.to.epochMs(chapter.createdUtc);
      return epochMs != null && epochMs > 0 ? DateTool.format.to.date({ epochMs, style, language, t }) : undefined;
    },
  },

  mark: {
    read({
      seriesId,
      chapterId,
      prevStatus,
      onUpdate,
    }: {
      seriesId: string;
      chapterId: string;
      prevStatus?: ChapterReadStatus;
      onUpdate?: (update: ChapterMarkUpdate) => void;
    }): Promise<ChapterMarkUpdate> {
      const optimistic: ChapterMarkUpdate = { seriesId, chapterId, readStatus: 'READ' };
      onUpdate?.(optimistic);
      emitReadStatusChanged(optimistic, 'optimistic', prevStatus);

      ChapterService.status.set({ seriesId, chapterId, isRead: true })
        .then(() => {
          onUpdate?.(optimistic);
          emitReadStatusChanged(optimistic, 'confirmed', prevStatus);
          // Keep the Kotlin digest cache from contradicting a write it already accepted — see
          // patchCache's own doc. Fire-and-forget: a failure here just means the cache stays
          // stale until its TTL expires, same as before this existed, never worth surfacing.
          ChapterService.status.patchCache({ seriesId, chapterId, isRead: true }).catch(() => {});
        })
        .catch(() => {
          const reverted: ChapterMarkUpdate = { seriesId, chapterId, readStatus: prevStatus ?? 'UNREAD' };
          onUpdate?.(reverted);
          // On revert the "previous" state, from the aggregate's point of view, is the optimistic
          // READ it already applied — so it can undo exactly that.
          emitReadStatusChanged(reverted, 'reverted', 'READ');
        });

      return Promise.resolve(optimistic);
    },

    unread({
      seriesId,
      chapterId,
      prevStatus,
      onUpdate,
    }: {
      seriesId: string;
      chapterId: string;
      prevStatus?: ChapterReadStatus;
      onUpdate?: (update: ChapterMarkUpdate) => void;
    }): Promise<ChapterMarkUpdate> {
      const optimistic: ChapterMarkUpdate = { seriesId, chapterId, readStatus: 'UNREAD' };
      onUpdate?.(optimistic);
      emitReadStatusChanged(optimistic, 'optimistic', prevStatus);

      ChapterService.status.set({ seriesId, chapterId, isRead: false })
        .then(() => {
          onUpdate?.(optimistic);
          emitReadStatusChanged(optimistic, 'confirmed', prevStatus);
          // See mark.read's own comment on patchCache — same rationale, opposite direction.
          ChapterService.status.patchCache({ seriesId, chapterId, isRead: false }).catch(() => {});
        })
        .catch(() => {
          const reverted: ChapterMarkUpdate = { seriesId, chapterId, readStatus: prevStatus ?? 'READ' };
          onUpdate?.(reverted);
          // On revert the "previous" state, from the aggregate's point of view, is the optimistic
          // UNREAD it already applied — so it can undo exactly that.
          emitReadStatusChanged(reverted, 'reverted', 'UNREAD');
        });

      return Promise.resolve(optimistic);
    },

    // Batch mark — ONE ChapterService.status.setMany call for the whole list (Kavita's
    // mark-multiple-read), not a loop of `read`/`unread`. Same optimistic → confirmed/reverted
    // shape, applied to every id: emit + onUpdate the optimistic value for each chapter now, one
    // network call, then on success re-emit 'confirmed' for each / on failure emit 'reverted'
    // (readStatus falls back to `prevStatusById[id] ?? UNREAD/READ`) for each. Looping the
    // single-chapter mark instead fires N parallel POSTs that saturate the server — the failures
    // then get optimistically reverted, which shows up as "marked chapters unmark themselves".
    readMany: (args: {
      seriesId: string;
      chapterIds: string[];
      prevStatusById?: Record<string, ChapterReadStatus>;
      onUpdate?: (update: ChapterMarkUpdate) => void;
      onUpdateMany?: (updates: ChapterMarkUpdate[]) => void;
    }): Promise<ChapterMarkUpdate[]> => markMany(args, true),

    unreadMany: (args: {
      seriesId: string;
      chapterIds: string[];
      prevStatusById?: Record<string, ChapterReadStatus>;
      onUpdate?: (update: ChapterMarkUpdate) => void;
      onUpdateMany?: (updates: ChapterMarkUpdate[]) => void;
    }): Promise<ChapterMarkUpdate[]> => markMany(args, false),

    // Reads the real current status first (so it can pass a real prevStatus down, instead of
    // read/unread's own binary-opposite default), then delegates — never re-implements the
    // optimistic/confirm/revert dance itself.
    toggle({
      seriesId,
      chapterId,
      onUpdate,
    }: {
      seriesId: string;
      chapterId: string;
      onUpdate?: (update: ChapterMarkUpdate) => void;
    }): Promise<ChapterMarkUpdate> {
      return ChapterService.get({ seriesId, chapterId }).then(digest => {
        const prevStatus: ChapterReadStatus = digest.isSuccess ? digest.readStatus : 'UNREAD';
        return prevStatus === 'READ'
          ? ChapterTool.mark.unread({ seriesId, chapterId, prevStatus, onUpdate })
          : ChapterTool.mark.read({ seriesId, chapterId, prevStatus, onUpdate });
      });
    },
  },
};

// ── ChaptersTool.sort — chapter sort preferences (global + per-series override) ────────────

// The canonical chapter-sort mode union for the whole app — screens/serie's serie.types.ts
// re-exports this one.
export type ChapterSortMode = 'ASCENDING' | 'DESCENDING' | 'AUTO_FIXED' | 'AUTO_PROGRESS';

export interface ChapterSortPrefs {
  mode: ChapterSortMode;
  fixedThreshold?: number;
  progressPercent: number;
}

const CHAPTER_SORT_PREFS_DOMAIN = 'chapterSortPrefs';
const GLOBAL_SORT_PREFS_KEY = 'global';
const DEFAULT_SORT_PREFS: ChapterSortPrefs = { mode: 'ASCENDING', progressPercent: 50 };

export type ChapterSortScope = { domain: 'global' } | { domain: 'series'; seriesId: string };

// Anything that isn't a usable prefs object reads as "nothing stored", so the caller falls back
// to DEFAULT_SORT_PREFS. Without this a stored value of the wrong shape — a string, a number,
// malformed JSON — still passed the `entry ? …` check and produced prefs whose `mode` was
// undefined, which silently reverted every list to ascending. (One real cause: another tool
// writing under the same key, since PreferencesManager identifies an entry by key alone.)
function readSortPrefs(key: string): Promise<ChapterSortPrefs | null> {
  return PreferencesManager.get({ key }).then(entry => {
    if (!entry) {return null;}
    const parsed = ((): unknown => {
      try {
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    })();
    const isUsable = typeof parsed === 'object' && parsed !== null && typeof (parsed as ChapterSortPrefs).mode === 'string';
    return isUsable ? (parsed as ChapterSortPrefs) : null;
  });
}

// get()'s two overloads mirror the scope: 'global' always returns the plain prefs (there's no
// "override" concept for the global default itself); 'series' returns the same plain shape PLUS
// `isOverride: true` — but only when a real per-series override exists. When it doesn't, the
// series lookup falls through to the exact same global read as 'global' would have made, and the
// result is indistinguishable from a globally-scoped call (no isOverride key at all) — its mere
// presence, not a boolean value, is what tells a caller "this came from an override". Declared as
// a standalone function (not inline in the ChaptersTool object literal below) — TypeScript
// doesn't allow overload signatures on an object literal's own method shorthand.
function getSortPrefs(scope: { domain: 'global' }): Promise<ChapterSortPrefs>;
function getSortPrefs(scope: { domain: 'series'; seriesId: string }): Promise<ChapterSortPrefs | (ChapterSortPrefs & { isOverride: true })>;
function getSortPrefs(scope: ChapterSortScope): Promise<ChapterSortPrefs | (ChapterSortPrefs & { isOverride: true })> {
  const seriesLookup = scope.domain === 'series' ? readSortPrefs(scope.seriesId) : Promise.resolve(null);

  return seriesLookup.then(seriesPrefs => {
    if (seriesPrefs) {return { ...seriesPrefs, isOverride: true as const };}
    return readSortPrefs(GLOBAL_SORT_PREFS_KEY).then(globalPrefs => globalPrefs ?? DEFAULT_SORT_PREFS);
  });
}

// ChaptersTool (plural) — separate from ChapterTool (singular, normalize/mark) above: this is a
// distinct set of concerns (a persisted preference, not a per-chapter domain operation) that
// happens to live in the same file/module since both are "chapter" domain, per the user's own
// call.
const CHAPTER_DATE_PREFS_DOMAIN = 'chapterDatePrefs';
const CHAPTER_DATE_STYLE_KEY = 'chapterDateStyle';
export const DEFAULT_CHAPTER_DATE_STYLE: DateStyle = 'LANGUAGE';

export const ChaptersTool = {
  // The shape of the date beside each chapter. Anything stored that is not a known style reads as
  // the default.
  dateStyle: {
    get(): Promise<DateStyle> {
      return PreferencesManager.get({ key: CHAPTER_DATE_STYLE_KEY })
        .then(entry => ((DATE_STYLES as readonly string[]).includes(entry?.value ?? '') ? (entry!.value as DateStyle) : DEFAULT_CHAPTER_DATE_STYLE))
        .catch(() => DEFAULT_CHAPTER_DATE_STYLE);
    },

    put({ style }: { style: DateStyle }): Promise<void> {
      return PreferencesManager.put({ key: CHAPTER_DATE_STYLE_KEY, value: style, domain: CHAPTER_DATE_PREFS_DOMAIN }).then(() => undefined);
    },
  },

  sort: {
    get: getSortPrefs,

    put(scope: ChapterSortScope, prefs: ChapterSortPrefs): Promise<void> {
      const key = scope.domain === 'series' ? scope.seriesId : GLOBAL_SORT_PREFS_KEY;
      return PreferencesManager.put({ key, value: JSON.stringify(prefs), domain: CHAPTER_SORT_PREFS_DOMAIN }).then(() => undefined);
    },

    // Removes the per-series override and returns the global default that now applies — there's
    // no "reset the global" concept (nothing to fall back to beyond DEFAULT_SORT_PREFS, already
    // covered by get({ domain: 'global' })).
    reset({ seriesId }: { seriesId: string }): Promise<ChapterSortPrefs> {
      return PreferencesManager.delete({ key: seriesId }).then(() => getSortPrefs({ domain: 'global' }));
    },
  },
};
