import { createStyles } from '../../../shared/theme';

export const homeStyles = createStyles(({ colors, text, spacing }) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[6] },
  label: { flex: 1, color: colors.text.label, fontSize: text.size[3], marginRight: spacing[5] },
  field: { marginBottom: spacing[6] },
  fieldLabel: { fontSize: text.size[3], color: colors.text.label, marginBottom: spacing[3] },
}));
