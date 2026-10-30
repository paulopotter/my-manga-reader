import { StyleSheet } from 'react-native';
import { createStyles } from '../../shared/theme';
export const readerStyles = createStyles(({ colors, text, spacing, radius }) => ({
    root: { flex: 1, backgroundColor: colors.surface.reading.background },
    centered: {
      flex: 1,
      backgroundColor: colors.surface.reading.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[8],
    },
    loadingText: { color: colors.text.secondary, fontSize: text.size[3], marginTop: spacing[5] },
    errorText: { color: colors.text.emphasis, fontSize: text.size[4], textAlign: 'center', marginBottom: spacing[6] },
    button: {
      backgroundColor: colors.button.secondary,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[8],
      borderRadius: radius.medium,
      marginBottom: spacing[4],
    },
    // "← Voltar" pinned to the top, the way every other screen offers the way out — so the error
    // state is the message and the retry, with nothing stacked beneath them.
    errorBack: {
      position: 'absolute',
      top: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[4],
    },
    errorBackText: { color: colors.text.primary, fontSize: text.size[3] },
    // The text of a button is named after the fill it sits on: this one is `button.secondary`, so its
    // text is `text.button.secondary` (the `primary` one is dark-on-bright and vanished on it).
    buttonText: { color: colors.text.button.secondary, fontSize: text.size[3] },
    // Switched into a chapter whose pages aren't in yet (fast arrow tap outran the fetch): a spinner
    // over the reading area while loadEntry fills it — the top bar already shows the new chapter, so
    // this only covers the page canvas.
    pageLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.surface.reading.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
}));

