import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { Routes, type NavOrigin } from '../../navigation/routes';
import { useStrings } from '../../shared/i18n';
import { useImmersive } from '../../shared/context/immersive';
import { buildPageLoadingNode, buildPageErrorNode } from './reader-sdu';
import { createNavigateAction, useAction } from '../../shared/tools/actions';
import { ChapterTool } from '../../shared/tools/chapters';
import {
  ReaderChapterPicker,
  ReaderOfflineBanner,
  ReaderOverlayFooter,
  ReaderPageListView,
  ReaderSettingsModal,
  ReaderSideProgressBar,
  ReaderTopBar,
  type ReaderChapterBlock,
} from './components';
import { useReader } from './hooks';
import { chapterPosition, progressBarFraction } from './reader.model';
import { windowToWebtoonBlocks } from './modes/webtoon.adapter';
import { readerStyles } from './reader.styles';
import { useTheme, useStyles } from '../../shared/context';
import { icon } from '../../shared/theme';
import { ReaderPrefs, type ProgressBarPosition } from '../../shared/tools/reader';
import { STATUS_BAR_GAP } from './components/reader-top-bar/reader-top-bar.styles';
import { ThinProgressBar } from '../../shared/components/thin-progress-bar';

type RouteParams = {
  Reader: { seriesId: string; chapterId: string; origin?: NavOrigin; seriesName?: string };
};

// Reader V2 screen — zero domain logic. It reads route params, forwards the native list's payload
// to the hook verbatim (the hook owns every decision), and renders what the hook exposes. The
// webtoon adapter turns the mode-agnostic window into native ChapterBlocks.
export function ReaderScreen() {
  const { colors } = useTheme();
  const styles = useStyles(readerStyles);
  const route = useRoute<RouteProp<RouteParams, 'Reader'>>();
  const { seriesId, chapterId, seriesName } = route.params ?? {};
  const t = useStrings();
  const { topInset } = useImmersive();

  const reader = useReader(seriesId, chapterId, seriesName);
  const { realize } = useAction();

  const [chapterPickerVisible, setChapterPickerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [progressBarPosition, setProgressBarPosition] = useState<ProgressBarPosition | undefined>(undefined);

  // Re-read whenever the settings modal closes — it's the only place this preference changes,
  // and re-fetching there (rather than threading a live callback through the modal) keeps this
  // screen from needing to know the modal's internal update mechanics.
  useEffect(() => {
    if (settingsVisible) {return;}
    ReaderPrefs.getProgressBarPosition()
      .then(setProgressBarPosition)
      .catch(() => {});
  }, [settingsVisible]);

  const handleBack = useCallback(() => realize(reader.backAction)(), [realize, reader.backAction]);
  // The series name goes to the series, from wherever the reader was opened. It replaces the reader
  // so that back from the series lands where the reader was entered, not on the reader again.
  const openSeries = useCallback(
    () => realize(createNavigateAction({ route: Routes.SERIES_DETAIL, params: { seriesId }, canReplace: true }))(),
    [realize, seriesId],
  );

  useEffect(() => {
    return () => {
      reader.onScreenExit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dumb: forward the native list's atomic position payload verbatim. The hook decides.
  const handleVisiblePageChanged = useCallback(
    (visibleChapterId: string, pageIndex: number, pageFraction: number, chapterFraction: number) => {
      reader.onNativePosition(visibleChapterId, pageIndex, pageFraction, chapterFraction);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reader.onNativePosition],
  );

  // Only webtoon has a native renderer today. When another mode is implemented this becomes a
  // switch(reader.readingMode) picking which <ReaderXxxView> to render — no change to the hook.
  const pageLoadingNode = useMemo(
    () => buildPageLoadingNode({ spinner: colors.icon.primary }),
    [colors],
  );
  const pageErrorNode = useMemo(
    () =>
      buildPageErrorNode({
        // The WithCode wording always: Kotlin substitutes {code} for a decode failure and drops it
        // (with its parentheses) otherwise — see resolvePlaceholder in SduNode.kt.
        message: t.readerPageErrorWithCode,
        retryLabel: t.readerRetry,
        tokens: {
          spinner: colors.icon.primary,
          errorText: colors.text.primary,
          retryBackground: colors.button.primary,
          retryText: colors.text.button.primary,
        },
      }),
    [colors, t],
  );

  const blocks: ReaderChapterBlock[] = useMemo(
    () => (reader.window ? windowToWebtoonBlocks(reader.window, reader.order, t) : []),
    [reader.window, reader.order, t],
  );

  if (!reader.window) {
    if (reader.error) {
      return (
        <View style={styles.centered}>
          <Pressable
            style={[styles.errorBack, { paddingTop: topInset + STATUS_BAR_GAP }]}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t.commonBackLabel}>
            <ArrowLeft size={icon.size[4]} color={colors.icon.primary} />
            <Text style={styles.errorBackText}>{t.commonBackLabel}</Text>
          </Pressable>
          <Text style={styles.errorText}>{t.readerError}</Text>
          <Pressable style={styles.button} onPress={() => reader.loadChapter(chapterId)}>
            <Text style={styles.buttonText}>{t.readerRetry}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.icon.primary} />
        <Text style={styles.loadingText}>{t.readerLoading}</Text>
      </View>
    );
  }

  const focused = reader.window.entries[reader.window.focusedIndex];
  const curr = focused.chapter;
  const currIsPlaceholder = focused.status === 'placeholder' || focused.status === 'loading';

  const scrollToChapterId = reader.scrollRequest?.chapterId ?? null;
  const scrollToPageIndex = reader.scrollRequest?.page ?? -1;

  // Which chapter of the series this is — undefined until the series order is in.
  const position = chapterPosition(reader.order, curr.id);
  const chapterIndicatorText =
    position != null
      ? t.readerChapterIndicator.replace('{0}', String(position.position)).replace('{1}', String(position.total))
      : undefined;

  // [Reader v2][diag] Task 029/030/031 debug — descomente ao investigar troca de capítulo.
  // console.log(
  //   `[Reader v2][diag] render blocks=[${blocks.map(b => `${b.chapterId}:${b.pageUrls.length}p`).join(',')}] focus=${curr.id} chFrac=${reader.chapterFraction.toFixed(3)} page=${reader.currentVisiblePage} scrollReq=${scrollToChapterId ?? 'null'}:${scrollToPageIndex}`,
  // );

  return (
    <View style={styles.root}>
      {/*
        key={reader.nativeListKey} — bumped by every openChapter/WINDOW_READY (open, arrow
        reload, jump). A changed key makes React unmount the native View and mount a fresh one,
        so a chapter switch rebuilds the LazyColumn straight onto the target chapter's top with
        no surviving scroll offset to fight. Natural-scroll crossings do NOT bump it (no remount
        mid-scroll).
      */}
      <ReaderPageListView
        key={reader.nativeListKey}
        blocks={blocks}
        scrollToChapterId={scrollToChapterId}
        scrollToPageIndex={scrollToPageIndex}
        onVisiblePageChanged={handleVisiblePageChanged}
        onScrollToChapterHandled={reader.handleScrollRequestHandled}
        onTap={reader.toggleOverlay}
        // Not tied to `readingMode`: that is a stored preference for modes that are still stubs, and
        // this native list is the only renderer the screen has, whatever the preference says.
        zoomEnabled
        onZoomChanged={reader.handleZoomChanged}
        pageLoadingNode={pageLoadingNode}
        pageErrorNode={pageErrorNode}
      />

      {currIsPlaceholder && (
        <View style={styles.pageLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.icon.primary} />
        </View>
      )}

      {!reader.overlayVisible && !reader.zoomed && (
        <ThinProgressBar
          fraction={progressBarFraction(reader.chapterFraction)}
          pageFraction={reader.scrollFraction}
          position={progressBarPosition}
        />
      )}
      <ReaderTopBar
        seriesName={reader.seriesName}
        chapterTitle={ChapterTool.format.title(curr, t)}
        pageIndicatorText={chapterIndicatorText}
        onBack={handleBack}
        backLabel={t.commonBackLabel}
        onSeriesPress={openSeries}
        seriesLabel={t.readerOpenSeriesLabel}
        visible={reader.overlayVisible}
      />
      <ReaderSideProgressBar
        totalPages={curr.pageUrls.length}
        currentPage={reader.currentVisiblePage}
        onPageSelect={reader.scrollToPage}
        onPrevChapter={() => reader.goToAdjacent('prev')}
        onNextChapter={() => reader.goToAdjacent('next')}
        hasPrev={reader.hasPrevChapter}
        hasNext={reader.hasNextChapter}
        prevChapterLabel={t.readerPrevChapterButtonLabel}
        nextChapterLabel={t.readerNextChapterButtonLabel}
        visible={reader.overlayVisible}
      />
      <ReaderOverlayFooter
        visible={reader.overlayVisible}
        t={t}
        onSelectChapter={() => setChapterPickerVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />
      <ReaderOfflineBanner visible={reader.offline} t={t} />

      <ReaderChapterPicker
        visible={chapterPickerVisible}
        chapters={reader.order}
        focusedChapterId={curr.id}
        t={t}
        onClose={() => setChapterPickerVisible(false)}
        onSelect={reader.goToChapter}
      />
      <ReaderSettingsModal visible={settingsVisible} t={t} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}
