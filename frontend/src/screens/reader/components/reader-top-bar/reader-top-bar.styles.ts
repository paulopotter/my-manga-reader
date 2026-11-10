import { createStyles } from '../../../../shared/theme';

// Gap between the status bar / cutout and the series name — the header sits right under it. The
// bar/cutout height itself comes from useImmersive().topInset (real insets, not a device guess).
export const STATUS_BAR_GAP = 6;

export const readerTopBarStyles = createStyles(({ colors, text, spacing, alpha }) => {
  // A text shadow (native to RN, no gradient lib needed) — legible over any page image behind
  // it, whereas the scrim alone (below) wasn't enough contrast for the series name's lighter/
  // smaller text on a bright manga page. `surface.dim` is this theme's own darkest/dimming
  // token, same source every other overlay scrim on this screen already uses — not a new color.
  const TEXT_SHADOW = {
    textShadowColor: alpha(colors.surface.dim, 0.85),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  };

  return {
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingBottom: spacing[4],
      paddingHorizontal: spacing[6],
      // Raised from 0.5 — the series name (lighter, smaller text) was unreadable over a bright
      // page image at the previous opacity.
      backgroundColor: alpha(colors.surface.dim, 0.78),
    },
    backButton: {
      justifyContent: 'center',
      marginRight: spacing[5],
    },
    titles: {
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: spacing[2],
    },
    titlesRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3] },
    seriesLink: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    seriesName: { color: colors.text.secondary, fontSize: text.size[2], ...TEXT_SHADOW },
    seriesShrink: { flexShrink: 1 },
    chapterTitle: { color: colors.text.title.primary, fontSize: text.size[5], fontWeight: text.weight.bold, alignSelf: 'flex-start', ...TEXT_SHADOW },
    pageIndicator: { color: colors.text.secondary, fontSize: text.size[2], ...TEXT_SHADOW },
  };
});

