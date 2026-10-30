import { createStyles } from '../../shared/theme';

export const bookReaderStyles = createStyles(({ colors, text, spacing, radius }) => ({
  root: { flex: 1, backgroundColor: colors.surface.primary },
  webview: { flex: 1, backgroundColor: colors.surface.primary },
  centered: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  message: { color: colors.text.secondary, fontSize: text.size[3], marginTop: spacing[5], textAlign: 'center' },
  errorText: { color: colors.text.emphasis, fontSize: text.size[4], textAlign: 'center', marginBottom: spacing[6] },
  button: {
    backgroundColor: colors.button.secondary,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: radius.medium,
  },
  // Named after the fill it sits on (`button.secondary`), not after the primary one.
  buttonText: { color: colors.text.button.secondary, fontSize: text.size[3] },
}));
