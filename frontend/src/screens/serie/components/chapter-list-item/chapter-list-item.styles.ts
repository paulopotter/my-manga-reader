import { createStyles, line as lineTokens, spacing as spacingTokens } from '../../../../shared/theme';

// A row's total height, as the sum of what it holds: its vertical padding twice plus one line of
// title. Exported because the chapter list hands it to FlatList (getItemLayout), which can then
// place every row without measuring any of them — the expensive part of scrolling a long list.
//
// This only stays true because `title` below pins its own lineHeight: without that the text
// would be as tall as the font decides, which is not a token and differs per platform, and the
// sum would silently stop matching what is drawn.
export const CHAPTER_ROW_HEIGHT = spacingTokens[5] * 2 + lineTokens.height[4];
export const chapterListItemStyles = createStyles(({ colors, text, line, spacing, radius, border, gutter }) => ({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[5],
      paddingHorizontal: gutter,
      backgroundColor: colors.surface.secondary,
    },
    zebra: { backgroundColor: colors.surface.primary },
    read: { opacity: 0.5 },
    selected: { backgroundColor: colors.surface.tertiary },
    checkbox: { width: 24, alignItems: 'center', justifyContent: 'center' },
    checkboxBox: {
      width: 18,
      height: 18,
      borderRadius: radius.small,
      borderWidth: border.medium,
      borderColor: colors.border.checkbox.off,
    },
    checkboxBoxChecked: {
      backgroundColor: colors.button.selected,
      borderColor: colors.border.checkbox.on,
    },
    title: { color: colors.text.title.primary, fontSize: text.size[3], lineHeight: line.height[4], marginLeft: spacing[4], flex: 1 },
    date: { color: colors.text.secondary, fontSize: text.size[2], lineHeight: line.height[4], marginLeft: spacing[4] },
    titleRead: { color: colors.text.secondary },
    titleSelected: { color: colors.text.title.primary, fontWeight: text.weight.bold },
}));

