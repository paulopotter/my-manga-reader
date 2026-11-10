import { createStyles } from '../../theme';
export const actionDialogStyles = createStyles(({ colors, text, spacing, radius, border, alpha }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: alpha(colors.surface.dim, 0.72),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing[8],
    },
    card: {
      backgroundColor: colors.surface.secondary,
      borderRadius: radius.large,
      paddingVertical: spacing[8],
      paddingHorizontal: spacing[8],
      width: '100%',
      gap: spacing[6],
    },
    title: { color: colors.text.title.primary, fontSize: text.size[5], fontWeight: text.weight.bold },
    message: { color: colors.text.secondary, fontSize: text.size[3] },
    actions: { gap: spacing[4] },
    btn: { paddingHorizontal: spacing[6], paddingVertical: spacing[4], borderRadius: radius.medium, alignItems: 'center' },
    btnPrimary: { backgroundColor: colors.button.primary },
    btnSecondary: { backgroundColor: 'transparent', borderWidth: border.medium, borderColor: alpha(colors.border.secondary, 0.2) },
    btnLabelPrimary: { color: colors.text.button.primary, fontSize: text.size[3], fontWeight: text.weight.bold },
    btnLabelSecondary: { color: alpha(colors.text.button.secondary, 0.8), fontSize: text.size[3], fontWeight: text.weight.bold },
}));
