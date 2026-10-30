import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, PixelRatio } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ChapterService } from '../../../shared/services/chapters';
import { SerialService } from '../../../shared/services/serials';
import { ChapterEvents, ChapterTool, chapterEvents } from '../../../shared/tools/chapters';
import { SerialRefreshTool } from '../../../shared/tools/serials';
import { EventBus, useEvent } from '../../../shared/managers/events';
import { useImmersive } from '../../../shared/context/immersive';
import { ReadingProgressManager } from '../../../shared/managers/store';
import { createBackAction } from '../../../shared/tools/actions';
import { Routes } from '../../../navigation/routes';
import type {
  FocusMoveTrigger,
  OrderedChapter,
  ReaderChapter,
  State,
} from '../reader.types';
import { ReaderEvents } from '../reader.events';
import { ReaderScreenControl } from '../reader.screen-control';
import { ReadingModeTool, type ReadingMode } from '../reading-mode.tool';
import {
  READ_THRESHOLD_FRACTION,
  adjacentChapterId,
  chapterFromDigest,
  isChapterEffectivelyRead,
  resolveInitialPage,
  shouldUnmarkOnReread,
  toOrderedChapters,
  withOrderNumber,
} from '../reader.model';
import { buildWindow, computeWindowAfterFocusMove, reconcileWindow } from '../reader.window';
// Imported straight from the adapter file, NOT via the modes/ barrel — a module-init ordering
// crash in the barrel graph took the app down on device (rc30). Keep it a direct named import of
// the plain function; never the READER_MODE_ADAPTERS object.
import { webtoonReportToTrigger } from '../modes/webtoon.adapter';
import { initialState, reducer } from './reader.reducer';

// Reader V2 hook — owns ALL reader state. The screen is dumb: it forwards the native payload
// verbatim and renders what this hook exposes.
//
// Chapter switching goes through ONE function, moveFocus(trigger). It just dispatches
// MOVE_FOCUS { trigger, order } — the REDUCER computes the transition against its own window, so
// two reports in the same React batch serialize correctly (the 2nd builds on the 1st). No
// settling timer, no parallel copy of the window in the hook. Placeholder prefetch is a single
// effect keyed on state.window; a stale open is dropped via openGenRef.

const LOCAL_SAVE_INTERVAL_MS = 2_000;
const SERVER_SYNC_INTERVAL_MS = 20_000;
const OVERSCROLL_TRIGGER_DP = 72;

export function useReader(seriesId: string, chapterId: string, seriesNameHint?: string) {
  const [state, dispatch] = useReducer(
    reducer,
    seriesNameHint ? { ...initialState, seriesName: seriesNameHint } : initialState,
  );

  // This screen's own "where do I fall back to" — real history (an in-app screen the user
  // actually came from, i.e. the Serie screen a normal navigate() into the Reader already
  // stacked) always wins first (canUseGoBack); this is only reached when there isn't any at all.
  // canResetStack: true — a deep link resolved directly by React Navigation's own `linking` prop
  // (linking.config.ts) always leaves *something* underneath (at minimum the Splash's own
  // initialRouteName), never real user history; canGoBack() would report true there and goBack()
  // would land back on that leftover screen instead of anywhere useful. Resetting the whole stack
  // to just the series screen guarantees no such leftover ever survives — and the series screen's
  // own backAction (useSerie) is exactly the same kind of safety net one level up, so a chain of
  // "no real history anywhere" always ends up at the Hub, never stuck in a loop.
  const backAction = useMemo(
    () => createBackAction({ route: Routes.SERIES_DETAIL, params: { seriesId }, canResetStack: true }),
    [seriesId],
  );

  const { setImmersive } = useImmersive();

  // ── live mirrors of state, for callbacks that must read the freshest committed value ──
  const stateRef = useRef<State>(state);
  stateRef.current = state;

  const currentPageRef = useRef(0);
  currentPageRef.current = state.currentVisiblePage;
  const scrollFractionRef = useRef(0);
  scrollFractionRef.current = state.scrollFraction;
  const chapterFractionRef = useRef(0);
  chapterFractionRef.current = state.chapterFraction;

  // ── series canonical order ──────────────────────────────────────────
  const orderRef = useRef<OrderedChapter[]>([]);
  const [orderTick, setOrderTick] = useState(0);

  // Bumped on every open — a stale openChapter response (a newer open started) checks this and
  // drops its result.
  const openGenRef = useRef(0);

  // ── reading mode ───────────────────────────────────────────────────
  // Only webtoon is implemented. The value is resolved (series → global → default) and exposed so
  // the screen can pick a renderer; the hook's own logic (onNativePosition) is webtoon-shaped for
  // now via the pure webtoonReportToTrigger, deliberately NOT via a mode-adapter object.
  const [readingMode, setReadingMode] = useState<ReadingMode>('webtoon');

  // ── mark bookkeeping ───────────────────────────────────────────────
  const lastSyncedPageRef = useRef<Map<string, number>>(new Map());
  const suppressServerSyncRef = useRef<Set<string>>(new Set());
  const sessionMarkedReadRef = useRef<Set<string>>(new Set());
  const sessionUnmarkedRef = useRef<Set<string>>(new Set());
  const wasReadOnOpenRef = useRef<Map<string, boolean>>(new Map());

  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Last { page, scrollFraction } written locally per chapter — lets the 2s timer skip a write
  // when nothing moved since its previous tick (GAP 3).
  const lastLocalSavedRef = useRef<Map<string, { page: number; scrollFraction: number }>>(new Map());

  // ── mark read / unread (via ChapterTool — emits ChapterEvents) ─────
  const applyMarkUpdate = useCallback(
    (update: { chapterId: string; readStatus: 'READ' | 'IN_PROGRESS' | 'UNREAD' }) => {
      dispatch({ type: 'OPTIMISTIC_MARK', chapterId: update.chapterId, readStatus: update.readStatus });
    },
    [],
  );

  const markAsReadIfNeeded = useCallback(
    (chapter: ReaderChapter) => {
      if (sessionMarkedReadRef.current.has(chapter.id)) {return;}
      sessionMarkedReadRef.current.add(chapter.id);
      suppressServerSyncRef.current.add(chapter.id);
      SerialRefreshTool.afterReading({ seriesId: chapter.seriesId });
      ChapterTool.mark.read({
        seriesId: chapter.seriesId,
        chapterId: chapter.id,
        prevStatus: chapter.readStatus,
        onUpdate: applyMarkUpdate,
      });
    },
    [applyMarkUpdate],
  );

  const unmarkIfRereading = useCallback(
    (chapter: ReaderChapter, currentPage: number, totalPages: number) => {
      const wasReadOnOpen = wasReadOnOpenRef.current.get(chapter.id) ?? false;
      if (
        !shouldUnmarkOnReread(
          wasReadOnOpen,
          currentPage,
          totalPages,
          sessionUnmarkedRef.current.has(chapter.id),
        )
      ) {
        return;
      }
      sessionUnmarkedRef.current.add(chapter.id);
      ChapterTool.mark.unread({
        seriesId: chapter.seriesId,
        chapterId: chapter.id,
        prevStatus: chapter.readStatus,
        onUpdate: applyMarkUpdate,
      });
    },
    [applyMarkUpdate],
  );

  // React to a mark from another screen (e.g. the series chapter list) while the reader is open.
  useEvent(ChapterEvents.readStatusChanged, payload => {
    const window = stateRef.current.window;
    if (!window) {return;}
    if (!window.entries.some(e => e.chapter.id === payload.chapter.id)) {return;}
    dispatch({ type: 'OPTIMISTIC_MARK', chapterId: payload.chapter.id, readStatus: payload.changed.readStatus });
  });

  // ── fetch one chapter's pages, merge into its window slot ──────────
  // Idempotent per id (inFlightRef) so the placeholder-prefetch effect can call it freely on
  // every window change. A result whose chapter has since left the window is dropped.
  const inFlightRef = useRef<Set<string>>(new Set());
  const loadEntry = useCallback(
    (chapterIdToLoad: string) => {
      if (inFlightRef.current.has(chapterIdToLoad)) {return;}
      inFlightRef.current.add(chapterIdToLoad);
      ChapterService.getFull({ seriesId, chapterId: chapterIdToLoad })
        .then(digest => {
          inFlightRef.current.delete(chapterIdToLoad);
          const window = stateRef.current.window;
          if (!window || !window.entries.some(e => e.chapter.id === chapterIdToLoad)) {return;}
          if (!digest.isSuccess) {
            dispatch({ type: 'ENTRY_ERROR', chapterId: chapterIdToLoad });
            return;
          }
          dispatch({
            type: 'ENTRY_LOADED',
            chapterId: chapterIdToLoad,
            chapter: withOrderNumber(chapterFromDigest(digest), orderRef.current),
          });
        })
        .catch(() => {
          inFlightRef.current.delete(chapterIdToLoad);
          const window = stateRef.current.window;
          if (window && window.entries.some(e => e.chapter.id === chapterIdToLoad)) {
            dispatch({ type: 'ENTRY_ERROR', chapterId: chapterIdToLoad });
          }
        });
    },
    [seriesId],
  );

  // Prefetch pages for every placeholder entry, whenever the window changes. This is the ONLY
  // place that reacts to the window shape for loading — the reducer owns the window, the hook
  // just fills its holes.
  useEffect(() => {
    if (!state.window) {return;}
    for (const entry of state.window.entries) {
      if (entry.status === 'placeholder') {loadEntry(entry.chapter.id);}
    }
  }, [state.window, loadEntry]);

  // Flush one chapter's reading position to BOTH stores at once — local (always) and server
  // (only while the chapter isn't effectively read, same rule the 20s timer's mark handling
  // uses). The single place all the "save now" callers go through: screen unmount
  // (onScreenExit), app backgrounding (AppState), and leaving a chapter via an arrow/jump
  // (openChapter). Best-effort, never awaited.
  const flushProgress = useCallback(
    (chapter: ReaderChapter, position: { page: number; scrollFraction: number }) => {
      ReadingProgressManager.set(chapter.id, {
        seriesId: chapter.seriesId,
        page: position.page,
        scrollFraction: position.scrollFraction,
      }).catch(() => {});
      lastLocalSavedRef.current.set(chapter.id, position);
      if (!isChapterEffectivelyRead(chapter)) {
        ChapterService.progress
          .set({ seriesId: chapter.seriesId, chapterId: chapter.id, pageIndex: position.page })
          .then(() => {
            lastSyncedPageRef.current.set(chapter.id, position.page);
            EventBus.emit(ReaderEvents.progressChanged, {
              seriesId: chapter.seriesId,
              chapterId: chapter.id,
              pageIndex: position.page,
            });
            SerialRefreshTool.afterReading({ seriesId: chapter.seriesId });
          })
          .catch(() => {});
      }
    },
    [],
  );

  // ── open the screen (or a non-adjacent jump-to-chapter) ────────────
  const openChapter = useCallback(
    (targetChapterId: string, opts?: { startAtBeginning?: boolean }) => {
      const gen = ++openGenRef.current;

      // GAP 2: an arrow / jump reloads a new chapter without going through onScreenExit, so the
      // chapter being left never gets its final position flushed — the [state.window] timers
      // effect only clearInterval()s on teardown, it doesn't save. Flush the outgoing chapter
      // here, before the window is rebuilt, unless we're reopening the very same chapter.
      const leaving = stateRef.current.window?.entries[stateRef.current.window.focusedIndex]?.chapter;
      if (leaving && leaving.id !== targetChapterId) {
        flushProgress(leaving, { page: currentPageRef.current, scrollFraction: scrollFractionRef.current });
      }

      dispatch({ type: 'LOADING' });

      Promise.all([
        ChapterService.getFull({ seriesId, chapterId: targetChapterId }),
        opts?.startAtBeginning ? Promise.resolve(null) : ReadingProgressManager.get(targetChapterId),
      ])
        .then(([digest, local]) => {
          if (openGenRef.current !== gen) {return;} // a newer open superseded this
          if (!digest.isSuccess) {
            dispatch({ type: 'ERROR', error: digest.error.message ?? 'Failed to load chapter' });
            return;
          }
          const order = orderRef.current;
          const curr = withOrderNumber(chapterFromDigest(digest), order);
          const known: ReaderChapter[] = [curr];
          let prevId: string | null = null;
          let nextId: string | null = null;
          if (digest.prevChapter?.isSuccess) {
            const prev = withOrderNumber(chapterFromDigest(digest.prevChapter), order);
            known.push(prev);
            prevId = prev.id;
          }
          if (digest.nextChapter?.isSuccess) {
            const next = withOrderNumber(chapterFromDigest(digest.nextChapter), order);
            known.push(next);
            nextId = next.id;
          }

          // Pass the neighbor ids explicitly: on the FIRST open the canonical series order
          // hasn't loaded yet, so buildWindow can't derive the prev from it — without this the
          // window would be [opened, next] and backward scroll would have no block to reach
          // (device bug: open on 104, can't scroll to 103 until you navigate away and back).
          const window = buildWindow(curr.id, order, known, { prevId, nextId });

          const initial = opts?.startAtBeginning
            ? { page: 0, scrollFraction: 0 }
            : resolveInitialPage(curr, local);

          const initialChapterFraction =
            curr.pageUrls.length > 1
              ? Math.min(0.9, (initial.page + initial.scrollFraction) / (curr.pageUrls.length - 1))
              : 0;

          if (!wasReadOnOpenRef.current.has(curr.id)) {
            wasReadOnOpenRef.current.set(curr.id, isChapterEffectivelyRead(curr));
          }

          dispatch({
            type: 'WINDOW_READY',
            window,
            initialPage: initial.page,
            initialScrollFraction: initial.scrollFraction,
            initialChapterFraction,
            scrollTo: { chapterId: curr.id, page: initial.page },
          });

          // The chapter is now genuinely open (digest resolved, window built) — announce it on
          // the chapter domain's own event. Fired here rather than on mount so it also covers
          // moving between chapters inside the reader (arrows/jump), and never fires for an open
          // that failed. Whoever cares reacts on their own (notifications marks its matching
          // history row read); this hook doesn't know who listens.
          //
          // Guarded: announcing is a side errand of opening, never a condition for it. Without
          // this, a throwing listener would fall into the .catch() below and blank out a reader
          // that had already loaded fine.
          try {
            chapterEvents({ seriesId, chapterId: curr.id }).opened.exec();
          } catch {
            // ignored on purpose — see above
          }
          // placeholder prefetch is handled by the [state.window] effect
        })
        .catch((e: unknown) => {
          if (openGenRef.current !== gen) {return;}
          dispatch({ type: 'ERROR', error: e instanceof Error ? e.message : 'Unknown error' });
        });
    },
    [seriesId, flushProgress],
  );

  // Back-compat alias used by the screen's retry button.
  const loadChapter = useCallback(
    (targetChapterId: string, startAtBeginning = false) =>
      openChapter(targetChapterId, startAtBeginning ? { startAtBeginning: true } : undefined),
    [openChapter],
  );

  useEffect(() => {
    openChapter(chapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  // ── moveFocus — natural-scroll crossings ONLY ─────────────────────
  // The overlay arrows reload the target chapter via openChapter (below) — they do NOT come here.
  // moveFocus dispatches MOVE_FOCUS and the REDUCER computes the transition against its own
  // window, so two reports in the same React batch serialize (the 2nd sees the 1st's move).
  const moveFocus = useCallback(
    (trigger: FocusMoveTrigger) => {
      // While a chapter (re)load is in flight the native list is about to be UNMOUNTED and rebuilt
      // (nativeListKey bump) — any native-scroll report right now is from the old, dying View.
      // Ignore until WINDOW_READY clears `loading`.
      if (stateRef.current.loading) {
        // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
        // console.log(`[Reader v2][diag] moveFocus ignored (loading) ${trigger.reportedChapterId}`);
        return;
      }
      const window = stateRef.current.window;
      if (!window) {return;}

      // Reject an internally-inconsistent native-scroll report. During a scroll the Kotlin side
      // can emit `page` (computeBottomVisiblePageIndex) and `chapterFraction`
      // (computeChapterFraction) that grossly disagree — e.g. page=43 of 44 with
      // chapterFraction=0.009 (device log rc35). Adopting it splits the overlay: dots jump to the
      // end while the progress bar stays empty. Drop it and wait for a stable one.
      const focusedChapter = window.entries[window.focusedIndex]?.chapter;
      const pageCount = focusedChapter?.pageUrls.length ?? 0;
      if (pageCount > 1 && trigger.reportedChapterId === focusedChapter?.id) {
        const pageImpliedFraction = trigger.page / (pageCount - 1);
        if (Math.abs(pageImpliedFraction - trigger.chapterFraction) > 0.5) {
          // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
          // console.log(
          //   `[Reader v2][diag] dropping inconsistent report p=${trigger.page}/${pageCount} chFrac=${trigger.chapterFraction.toFixed(3)}`,
          // );
          return;
        }
      }

      // Peek at the outcome only to fire the "leaving a scrolled-through chapter" mark — the
      // reducer will recompute it as the real state transition.
      const preview = computeWindowAfterFocusMove(window, orderRef.current, trigger);
      // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
      // console.log(
      //   `[Reader v2][diag] moveFocus -> ${preview.kind}${preview.kind === 'focus-moved' ? ` newFocus=${preview.window.entries[preview.window.focusedIndex].chapter.id}` : ''}`,
      // );
      if (preview.kind === 'noop') {return;}
      if (preview.kind === 'focus-moved' && chapterFractionRef.current >= READ_THRESHOLD_FRACTION) {
        const leaving = window.entries[window.focusedIndex];
        if (leaving) {markAsReadIfNeeded(leaving.chapter);}
      }
      if (preview.kind === 'position-only' && preview.chapterFraction >= READ_THRESHOLD_FRACTION) {
        const focused = window.entries[window.focusedIndex];
        if (focused) {markAsReadIfNeeded(focused.chapter);}
      }

      dispatch({ type: 'MOVE_FOCUS', trigger, order: orderRef.current });
    },
    [markAsReadIfNeeded],
  );

  // ── re-fire a deferred scroll once its target chapter has pages ────
  // openChapter / an arrow may set scrollRequest against a chapter that's still a placeholder
  // (fast tap outran the fetch). The native LaunchedEffect can't scroll to a block with no pages
  // and clears the request. We remember it here ONLY while its target is not ready, and re-issue
  // once loadEntry fills that slot. A request whose target is already ready is handled by the
  // native list directly — never armed here, so it can't re-fire after being consumed.
  const pendingScrollRef = useRef<{ chapterId: string; page: number } | null>(null);
  useEffect(() => {
    if (state.scrollRequest && state.window) {
      const target = state.window.entries.find(e => e.chapter.id === state.scrollRequest!.chapterId);
      pendingScrollRef.current = target && target.status !== 'ready' ? state.scrollRequest : null;
      return;
    }
    const pending = pendingScrollRef.current;
    if (!pending || !state.window) {return;}
    const entry = state.window.entries.find(e => e.chapter.id === pending.chapterId);
    if (entry && entry.status === 'ready') {
      // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
      // console.log(`[Reader v2][diag] deferred scroll re-fire ch=${pending.chapterId} p=${pending.page}`);
      pendingScrollRef.current = null;
      dispatch({ type: 'SCROLL_TO_PAGE', page: pending.page });
    }
  }, [state.scrollRequest, state.window]);

  // ── native list -> hook. Screen forwards this verbatim; the hook owns the decision. ──
  // Uses the plain webtoonReportToTrigger imported straight from modes/webtoon.adapter.ts, NOT
  // via the modes/ barrel or the adapter object — this runs on the very first native scroll
  // event, and pulling the barrel module graph here risks a module-init ordering crash that
  // takes the whole app down (seen on device, rc30). When a non-webtoon mode ships, this becomes
  // a per-mode dispatch that still resolves to a plain function, never an object deref.
  const onNativePosition = useCallback(
    (chapterId_: string, page: number, pageFraction: number, chapterFraction: number) => {
      // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
      // console.log(
      //   `[Reader v2][diag] nativePos ch=${chapterId_} p=${page} chFrac=${chapterFraction.toFixed(3)} | win=[${stateRef.current.window?.entries.map(e => `${e.chapter.id}:${e.status[0]}`).join(',')}] focus=${stateRef.current.window?.focusedIndex}`,
      // );
      const trigger = webtoonReportToTrigger({
        chapterId: chapterId_,
        pageIndex: page,
        pageFraction,
        chapterFraction,
      });
      if (trigger) {moveFocus(trigger);}
    },
    [moveFocus],
  );

  // ── overlay arrows / overscroll — RELOAD the target chapter ────────
  // "location.replace": pick the next/prev chapter id from the canonical order relative to the
  // CURRENT focus, then run the exact open flow (getFull → WINDOW_READY → nativeListKey bump →
  // the native list UNMOUNTS and a fresh one mounts straight onto the target chapter). No
  // programmatic scroll — remounting is what makes the jump reliable; scrollToItem /
  // scrollToPositionWithOffset both proved unreliable across 9 device builds (the list consumed
  // the request but stayed anchored on a surviving block).
  const goToAdjacent = useCallback(
    (direction: 'next' | 'prev') => {
      const window = stateRef.current.window;
      if (!window) {return;}
      const focusedId = window.entries[window.focusedIndex]?.chapter.id;
      if (!focusedId) {return;}
      const targetId = adjacentChapterId(orderRef.current, focusedId, direction);
      // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
      // console.log(`[Reader v2][diag] goToAdjacent ${direction} from=${focusedId} -> reload ${targetId ?? 'null (series end)'}`);
      if (targetId) {
        openChapter(targetId, { startAtBeginning: true });
      }
    },
    [openChapter],
  );
  const goToNextChapterManual = useCallback(() => goToAdjacent('next'), [goToAdjacent]);
  const goToPrevChapterManual = useCallback(() => goToAdjacent('prev'), [goToAdjacent]);

  // Jump to ANY chapter of the series, not just the adjacent one — the overlay footer's chapter
  // picker uses this. Same "location.replace" flow as goToAdjacent (openChapter handles the
  // flush-outgoing-progress / WINDOW_READY / nativeListKey remount); the only difference is the
  // target isn't derived from the current focus, it's whatever the picker chose. A no-op if
  // asked to jump to the chapter already open (openChapter itself skips the outgoing flush then).
  const goToChapter = useCallback(
    (targetChapterId: string) => {
      openChapter(targetChapterId, { startAtBeginning: true });
    },
    [openChapter],
  );

  const overscrollArmedRef = useRef(true);
  const overscrollTriggerPx = PixelRatio.getPixelSizeForLayoutSize(OVERSCROLL_TRIGGER_DP);
  const handleScroll = useCallback(
    (contentOffsetY: number, isFirstItemChapterHeader: boolean) => {
      if (
        contentOffsetY < -overscrollTriggerPx &&
        isFirstItemChapterHeader &&
        overscrollArmedRef.current
      ) {
        overscrollArmedRef.current = false;
        goToAdjacent('prev');
      }
    },
    [overscrollTriggerPx, goToAdjacent],
  );
  const handleScrollEndDrag = useCallback((contentOffsetY: number) => {
    if (contentOffsetY >= 0) {overscrollArmedRef.current = true;}
  }, []);

  // ── series canonical order (SerialService.get, light) ──────────────
  useEffect(() => {
    let cancelled = false;
    SerialService.get({ seriesId })
      .then(digest => {
        if (cancelled || !digest.isSuccess) {return;}
        orderRef.current = toOrderedChapters(digest);
        setOrderTick(t => t + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  // The order above is the light digest's chapter list, served cache-first — and that variant has no
  // staleness guard of its own (the series screen's variant does). A chapter that arrived after it was
  // cached (a push notification's) is therefore missing from it, or is its last entry with newer ones
  // unseen: setas, bolinhas and the infinite scroll all read "no next chapter" and the reader stops at
  // the end of the chapter. When the focused chapter is either of those, ask the server once, with
  // force, which rewrites the entry. Once per open: a series that really ends here costs one fetch.
  const forcedOrderRefreshRef = useRef(false);
  useEffect(() => {
    if (orderTick === 0 || forcedOrderRefreshRef.current) {return;}
    const window = state.window;
    const focusedId = window?.entries[window.focusedIndex]?.chapter.id;
    if (!focusedId) {return;}
    const order = orderRef.current;
    const index = order.findIndex(c => c.id === focusedId);
    if (index !== -1 && index < order.length - 1) {return;}
    forcedOrderRefreshRef.current = true;
    SerialService.get({ seriesId, force: true })
      .then(digest => {
        if (!digest.isSuccess) {return;}
        orderRef.current = toOrderedChapters(digest);
        setOrderTick(t => t + 1);
      })
      .catch(() => {});
  }, [orderTick, state.window, seriesId]);

  // Reconcile the window once BOTH the series order and the window exist (either can land first):
  // re-apply each entry's series-order `number` and grow both ends so the focused chapter has a
  // neighbour on each side — this is where the prev chapter enters on a cold open (the bare
  // getFull carries no embedded neighbors). The [state.window] effect prefetches any new
  // placeholders. Runs again whenever the window identity changes so a post-open order arrival
  // still reconciles.
  useEffect(() => {
    if (orderTick === 0) {return;}
    const window = stateRef.current.window;
    if (!window) {return;}
    const reconciled = reconcileWindow(window, orderRef.current);
    if (reconciled !== window) {
      dispatch({ type: 'SET_WINDOW', window: reconciled, scrollTo: null });
    }
  }, [orderTick, state.window]);

  // ── series name (fast-path hint or fallback fetch) ────────────────
  useEffect(() => {
    if (seriesNameHint) {return;}
    let cancelled = false;
    SerialService.get({ seriesId })
      .then(digest => {
        if (!cancelled && digest.isSuccess) {
          dispatch({ type: 'SERIES_NAME_LOADED', seriesName: digest.name });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seriesId, seriesNameHint]);

  // ── reading mode ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    ReadingModeTool.get({ domain: 'series', seriesId })
      .then(prefs => {
        if (!cancelled) {setReadingMode(prefs.mode);}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  // ── wasReadOnOpen per focused chapter ────────────────────────────
  useEffect(() => {
    const window = state.window;
    if (!window) {return;}
    const curr = window.entries[window.focusedIndex]?.chapter;
    if (curr && !wasReadOnOpenRef.current.has(curr.id)) {
      wasReadOnOpenRef.current.set(curr.id, isChapterEffectivelyRead(curr));
    }
  }, [state.window]);

  // Flush one chapter's reading position to BOTH stores at once — local (always) and server
  // (only while the chapter isn't effectively read, same rule the 20s timer's mark handling
  // uses). The single place all the "save now" callers go through: screen unmount
  // (onScreenExit), app backgrounding (AppState), and leaving a chapter via an arrow/jump
  // (openChapter). Best-effort, never awaited.
  // ── progress timers: local every 2s, server every 20s ───────────
  useEffect(() => {
    const window = state.window;
    if (!window) {return undefined;}
    const focused = window.entries[window.focusedIndex]?.chapter;
    if (!focused) {return undefined;}
    const { id: chId, seriesId: chSeriesId } = focused;

    localTimerRef.current = setInterval(() => {
      const page = currentPageRef.current;
      const scrollFraction = scrollFractionRef.current;
      // GAP 3: skip the Room write when nothing moved since the previous tick.
      const last = lastLocalSavedRef.current.get(chId);
      if (last && last.page === page && last.scrollFraction === scrollFraction) {return;}
      lastLocalSavedRef.current.set(chId, { page, scrollFraction });
      ReadingProgressManager.set(chId, { seriesId: chSeriesId, page, scrollFraction }).catch(() => {});
    }, LOCAL_SAVE_INTERVAL_MS);

    syncTimerRef.current = setInterval(() => {
      const page = currentPageRef.current;
      if (page === lastSyncedPageRef.current.get(chId)) {return;}
      if (suppressServerSyncRef.current.has(chId)) {return;}
      ChapterService.progress
        .set({ seriesId: chSeriesId, chapterId: chId, pageIndex: page })
        .then(() => {
          lastSyncedPageRef.current.set(chId, page);
          EventBus.emit(ReaderEvents.progressChanged, { seriesId: chSeriesId, chapterId: chId, pageIndex: page });
          SerialRefreshTool.afterReading({ seriesId: chSeriesId });
        })
        .catch(() => {});
    }, SERVER_SYNC_INTERVAL_MS);

    return () => {
      if (localTimerRef.current) {clearInterval(localTimerRef.current);}
      if (syncTimerRef.current) {clearInterval(syncTimerRef.current);}
    };
  }, [state.window]);

  // ── mark-as-read at 98% / unmark on reread ──────────────────────
  const lastProcessedChapterIdRef = useRef<string | null>(null);
  useEffect(() => {
    const window = state.window;
    if (!window) {return;}
    const curr = window.entries[window.focusedIndex]?.chapter;
    if (!curr) {return;}
    const isFirstRenderOfChapter = lastProcessedChapterIdRef.current !== curr.id;
    lastProcessedChapterIdRef.current = curr.id;
    if (!isFirstRenderOfChapter) {
      unmarkIfRereading(curr, state.currentVisiblePage, curr.pageUrls.length);
    }
    if (curr.pageUrls.length > 0 && state.chapterFraction >= READ_THRESHOLD_FRACTION) {
      markAsReadIfNeeded(curr);
    }
  }, [state.window, state.currentVisiblePage, state.chapterFraction, markAsReadIfNeeded, unmarkIfRereading]);

  const onScreenExit = useCallback(() => {
    if (localTimerRef.current) {clearInterval(localTimerRef.current);}
    if (syncTimerRef.current) {clearInterval(syncTimerRef.current);}
    const window = stateRef.current.window;
    if (!window) {return;}
    const curr = window.entries[window.focusedIndex]?.chapter;
    if (!curr) {return;}
    flushProgress(curr, { page: currentPageRef.current, scrollFraction: scrollFractionRef.current });
  }, [flushProgress]);

  // GAP 1: the reader is only unmounted on a "back" press. Backgrounding the app (home button)
  // or the OS killing it never runs onScreenExit — so the same flush has to happen when the app
  // goes inactive/background, or the server can sit up to a full 20s sync interval behind.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'background' && next !== 'inactive') {return;}
      const window = stateRef.current.window;
      const curr = window?.entries[window.focusedIndex]?.chapter;
      if (curr) {
        flushProgress(curr, { page: currentPageRef.current, scrollFraction: scrollFractionRef.current });
      }
    });
    return () => sub.remove();
  }, [flushProgress]);

  // ── keep screen on / immersive / offline ───────────────────────
  useEffect(() => {
    let cancelled = false;
    ReaderScreenControl.fetchKeepScreenOnPref()
      .then(enabled => {
        if (!cancelled && enabled) {ReaderScreenControl.keepScreenOn().catch(() => {});}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ReaderScreenControl.allowScreenOff().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    ReaderScreenControl.fetchImmersiveModePref()
      .then(enabled => {
        if (!cancelled && enabled) {
          ReaderScreenControl.setImmersiveMode(true).catch(() => {});
          // Tell the app shell to drop its root status-bar padding so the reader goes fully
          // edge-to-edge (behind the cutout). The Kotlin side hides the bars + SHORT_EDGES; this
          // removes the RN-side paddingTop that would otherwise still push the content down.
          setImmersive(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ReaderScreenControl.setImmersiveMode(false).catch(() => {});
      setImmersive(false);
    };
  }, [setImmersive]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      dispatch({ type: 'SET_OFFLINE', offline: netState.isConnected === false });
    });
    return () => unsubscribe();
  }, []);

  // ── overlay / scroll plumbing ─────────────────────────────────
  const toggleOverlay = useCallback(() => dispatch({ type: 'TOGGLE_OVERLAY' }), []);
  const handleZoomChanged = useCallback((zoomed: boolean) => dispatch({ type: 'SET_ZOOMED', zoomed }), []);
  const scrollToPage = useCallback((page: number) => dispatch({ type: 'SCROLL_TO_PAGE', page }), []);
  const handleScrollRequestHandled = useCallback(
    () => dispatch({ type: 'SCROLL_REQUEST_HANDLED' }),
    [],
  );

  // Whether the overlay arrows should be enabled — based on the canonical series order relative
  // to the FOCUSED chapter, NOT on whether the window has an entry that side (the window only
  // grows toward `next`, so a window-based check would keep ▲ permanently disabled).
  const focusedIdForArrows = state.window?.entries[state.window.focusedIndex]?.chapter.id ?? null;
  const hasPrevChapter =
    focusedIdForArrows != null && adjacentChapterId(orderRef.current, focusedIdForArrows, 'prev') != null;
  const hasNextChapter =
    focusedIdForArrows != null && adjacentChapterId(orderRef.current, focusedIdForArrows, 'next') != null;

  return {
    ...state,
    readingMode,
    backAction,
    order: orderRef.current,
    hasPrevChapter,
    hasNextChapter,
    dispatch,
    toggleOverlay,
    handleZoomChanged,
    scrollToPage,
    handleScrollRequestHandled,
    onNativePosition,
    onScreenExit,
    moveFocus,
    goToAdjacent,
    goToNextChapterManual,
    goToPrevChapterManual,
    goToChapter,
    loadChapter,
    handleScroll,
    handleScrollEndDrag,
  };
}
