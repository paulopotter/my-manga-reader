import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  BUBBLE_HALF_HEIGHT,
  DOT_GAP,
  DOT_SIZE,
  THUMB_SIZE,
  readerSideProgressBarStyles,
} from './reader-side-progress-bar.styles';
import { fitsAsDots, fractionOfPage, pageAtOffset } from './reader-side-progress-bar.scrubber';
import { useTheme, useStyles } from '../../../../shared/context';
import { icon } from '../../../../shared/theme';
import { IconButton } from '../../../../shared/components/icon-button';

interface Props {
  totalPages: number;
  currentPage: number;
  onPageSelect: (index: number) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  prevChapterLabel: string;
  nextChapterLabel: string;
  visible: boolean;
}

// Dumb: renders arrows + the pages it's given; fires the callbacks. The pages are one dot each while
// they fit between the arrows; a chapter with more pages than that becomes a scrubber — a track with a
// thumb you tap or drag, a bubble naming the page under your finger, and the jump made on release —
// so every page stays reachable however long the chapter is.
export function ReaderSideProgressBar({
  totalPages,
  currentPage,
  onPageSelect,
  onPrevChapter,
  onNextChapter,
  hasPrev,
  hasNext,
  prevChapterLabel,
  nextChapterLabel,
  visible,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles(readerSideProgressBarStyles);

  // Measured height of the pill; null until its first layout (the dots show until then).
  const [height, setHeight] = useState<number | null>(null);
  // The page under the finger while dragging, null otherwise. Local on purpose: the list is only
  // asked to scroll once, on release, instead of on every move.
  const [dragPage, setDragPage] = useState<number | null>(null);

  const travel = Math.max(0, (height ?? 0) - 2 * DOT_GAP - THUMB_SIZE);

  // The responder lives as long as the bar; everything it reads goes through this ref so it never
  // sees a stale prop or height.
  const live = useRef({ totalPages, travel, onPageSelect });
  live.current = { totalPages, travel, onPageSelect };
  const startY = useRef(0);
  const lastPage = useRef(0);

  const panResponder = useMemo(() => {
    const pageAt = (y: number) =>
      pageAtOffset({
        offset: y - DOT_GAP - THUMB_SIZE / 2,
        trackHeight: live.current.travel,
        totalPages: live.current.totalPages,
      });
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: event => {
        startY.current = event.nativeEvent.locationY;
        lastPage.current = pageAt(startY.current);
        setDragPage(lastPage.current);
      },
      onPanResponderMove: (_event, gesture) => {
        lastPage.current = pageAt(startY.current + gesture.dy);
        setDragPage(lastPage.current);
      },
      onPanResponderRelease: () => {
        live.current.onPageSelect(lastPage.current);
        setDragPage(null);
      },
      onPanResponderTerminate: () => setDragPage(null),
    });
  }, []);

  if (!visible) {return null;}

  const asDots = fitsAsDots({ totalPages, height, dotSize: DOT_SIZE, gap: DOT_GAP, padding: DOT_GAP });
  const shownPage = dragPage ?? currentPage;
  const thumbTop = DOT_GAP + fractionOfPage({ page: shownPage, totalPages }) * travel;

  return (
    <View style={styles.root}>
      <IconButton
        icon={ChevronUp}
        glyph="chevron"
        size={icon.size[4]}
        color={hasPrev ? colors.icon.primary : colors.icon.tertiary}
        onPress={() => {
          if (hasPrev) {onPrevChapter();}
        }}
        accessibilityLabel={prevChapterLabel}
        style={styles.arrowButton}
      />
      <View
        style={styles.dots}
        testID="reader-side-progress-bar-pill"
        onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}>
        {asDots ? (
          Array.from({ length: totalPages }, (_, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dotTouchable}
              onPress={() => onPageSelect(index)}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}>
              <View
                style={[
                  styles.dot,
                  index < currentPage && styles.dotRead,
                  index === currentPage && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))
        ) : (
          <>
            <View style={[styles.track, { top: DOT_GAP + THUMB_SIZE / 2, height: travel }]} pointerEvents="none" />
            <View
              style={[styles.trackFill, { top: DOT_GAP + THUMB_SIZE / 2, height: thumbTop - DOT_GAP }]}
              pointerEvents="none"
            />
            <View style={[styles.thumb, { top: thumbTop }]} pointerEvents="none" />
            {dragPage != null && (
              <View
                testID="reader-side-progress-bar-bubble-row"
                style={[styles.bubbleRow, { top: thumbTop + THUMB_SIZE / 2 - BUBBLE_HALF_HEIGHT }]}
                pointerEvents="none">
                <View style={styles.bubble}>
                  <Text style={styles.bubbleText} numberOfLines={1}>{`${dragPage + 1} / ${totalPages}`}</Text>
                </View>
              </View>
            )}
            {/* The touch surface: nothing inside it, so locationY is always relative to the pill. */}
            <View
              testID="reader-side-progress-bar-scrubber"
              style={styles.scrubberSurface}
              {...panResponder.panHandlers}
            />
          </>
        )}
      </View>
      <IconButton
        icon={ChevronDown}
        glyph="chevron"
        size={icon.size[4]}
        color={hasNext ? colors.icon.primary : colors.icon.tertiary}
        onPress={() => {
          if (hasNext) {onNextChapter();}
        }}
        accessibilityLabel={nextChapterLabel}
        style={styles.arrowButton}
      />
    </View>
  );
}
