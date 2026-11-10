import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { SerieChapter } from '../../../../shared';
import { chapterListItemStyles } from './chapter-list-item.styles';
import { useStyles } from '../../../../shared/context';

interface Props {
  chapter: SerieChapter;
  // Finished label string, composed by the caller via ChapterTool.format.title — this dumb
  // component never derives it (real title vs. "Capítulo N" vs. special-label is domain logic
  // that lives in the tool, not here).
  title: string;
  // Finished date string (already in the user's chosen format), composed by the caller via
  // ChapterTool.format.date. Absent = the chapter has no usable date and none is drawn.
  dateLabel?: string;
  index: number;
  selectionMode: boolean;
  selected: boolean;
  onPress: (chapterId: string) => void;
  onLongPress: (chapterId: string) => void;
}

// Dumb: only decides how to render the data it's given (zebra striping by index, checkbox when
// in selection mode) — no fetching, no domain logic.
//
// Memoized because a long series renders hundreds of these: without it, every list update
// re-rendered all of them, which RN itself flagged on device ("large list that is slow to
// update", 10s for one update on a 914-chapter series).
//
// Memoization only holds while the props stay referentially stable, so the press handlers take
// the chapter id rather than being wrapped in a closure by the caller — a `() => onPress(id)`
// built inside renderItem is a new function on every render and would defeat this entirely.
export const ChapterListItem = React.memo(function ChapterListItem({
  chapter,
  title,
  dateLabel,
  index,
  selectionMode,
  selected,
  onPress,
  onLongPress,
}: Props) {
  const styles = useStyles(chapterListItemStyles);
  const isRead = chapter.readStatus === 'READ';
  const isZebra = index % 2 === 1;

  const handlePress = React.useCallback(() => onPress(chapter.id), [onPress, chapter.id]);
  const handleLongPress = React.useCallback(() => onLongPress(chapter.id), [onLongPress, chapter.id]);

  return (
    <TouchableOpacity
      style={[styles.root, isZebra && styles.zebra, isRead && !selected && styles.read, selected && styles.selected]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}>
      <View style={styles.checkbox}>
        {selectionMode && <View style={[styles.checkboxBox, selected && styles.checkboxBoxChecked]} />}
      </View>
      <Text style={[styles.title, isRead && !selected && styles.titleRead, selected && styles.titleSelected]} numberOfLines={1}>
        {title}
      </Text>
      {dateLabel != null && (
        <Text style={[styles.date, isRead && !selected && styles.titleRead]} numberOfLines={1}>
          {dateLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
});
