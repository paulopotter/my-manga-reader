import { StyleSheet } from 'react-native';
import { createStyles } from '../../../../shared/theme';
export const ARROW_BUTTON_SIZE = 32;
export const DOT_SIZE = 6;
// Minimum gap between dots = half the dot size. The dots container always spans arrow to arrow
// (flex:1); dots distribute via space-evenly. When the pages no longer fit at that gap the bar
// stops drawing one dot per page and becomes a scrubber (see the component).
export const DOT_GAP = DOT_SIZE / 2;
export const DOTS_WIDTH = 28;
// The scrubber's own parts: a thin track, and a thumb wide enough to grab.
export const TRACK_WIDTH = 4;
export const THUMB_SIZE = 14;
// The bubble is about one text line tall; centring it on the thumb only needs half of that.
export const BUBBLE_HALF_HEIGHT = 16;
// Room for "9999 / 9999" at the bubble's size, with margin.
export const BUBBLE_ROW_WIDTH = 160;

export const readerSideProgressBarStyles = createStyles(({ colors, spacing, radius, alpha, text }) => ({
    root: {
      position: 'absolute',
      right: 8,
      top: 92,
      bottom: '8%',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    arrowButton: {
      width: ARROW_BUTTON_SIZE,
      height: ARROW_BUTTON_SIZE,
      borderRadius: ARROW_BUTTON_SIZE / 2,
      backgroundColor: alpha(colors.surface.dim, 0.72),
      alignItems: 'center',
      justifyContent: 'center',
    },
    dots: {
      flex: 1,
      justifyContent: 'space-evenly',
      alignItems: 'center',
      paddingVertical: DOT_GAP,
      marginVertical: spacing[2],
      width: DOTS_WIDTH,
      borderRadius: radius.full,
      backgroundColor: alpha(colors.surface.dim, 0.72),
    },
    dotTouchable: { alignItems: 'center', justifyContent: 'center' },
    dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: colors.progress.reading.secondary },
    // Read page: same gold as the thin progress bar (#FFC107) at reduced opacity, to differ from
    // the active page without competing with its highlight.
    dotRead: { backgroundColor: alpha(colors.progress.reading.primary, 0.5) },
    dotActive: { backgroundColor: colors.progress.reading.primary, width: 8, height: 8, borderRadius: radius.small },
    // Scrubber: the track runs the pill's whole inner height, filled up to the thumb with the same
    // gold the read dots use, so "how far through" reads the same in either shape.
    track: {
      position: 'absolute',
      left: (DOTS_WIDTH - TRACK_WIDTH) / 2,
      width: TRACK_WIDTH,
      borderRadius: TRACK_WIDTH / 2,
      backgroundColor: colors.progress.reading.secondary,
    },
    trackFill: {
      position: 'absolute',
      left: (DOTS_WIDTH - TRACK_WIDTH) / 2,
      width: TRACK_WIDTH,
      borderRadius: TRACK_WIDTH / 2,
      backgroundColor: alpha(colors.progress.reading.primary, 0.5),
    },
    thumb: {
      position: 'absolute',
      left: (DOTS_WIDTH - THUMB_SIZE) / 2,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: colors.progress.reading.primary,
    },
    // The touch surface laid over the pill: nothing inside it, so a touch's locationY is relative to it.
    scrubberSurface: { ...StyleSheet.absoluteFillObject },
    // Shown beside the thumb only while it is being dragged: the page the finger is on. The pill is
    // narrower than the text, and an absolute child is only as wide as its parent allows — so the bubble
    // sits in a wide row that ends at the pill and lets it be as wide as its text, on one line.
    bubbleRow: {
      position: 'absolute',
      right: DOTS_WIDTH + spacing[3],
      width: BUBBLE_ROW_WIDTH,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    bubble: {
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[4],
      borderRadius: radius.medium,
      backgroundColor: alpha(colors.surface.dim, 0.85),
    },
    bubbleText: { color: colors.text.primary, fontSize: text.size[3], fontWeight: text.weight.bold },
}));
