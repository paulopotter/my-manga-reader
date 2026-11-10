import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { STATUS_BAR_GAP, readerTopBarStyles } from './reader-top-bar.styles';
import { useTheme, useStyles } from '../../../../shared/context';
import { icon } from '../../../../shared/theme';
import { useImmersive } from '../../../../shared/context/immersive';
import { IconButton } from '../../../../shared/components/icon-button';

interface Props {
  seriesName: string;
  chapterTitle: string;
  // Ready-made progress text shown beside the series name (the reader passes "Cap. 2 de 40") —
  // undefined means the caller has nothing true to show yet.
  pageIndicatorText?: string;
  onBack: () => void;
  backLabel: string;
  // When given, the series name is a link to the series' own screen (whatever screen the reader came from).
  onSeriesPress?: () => void;
  seriesLabel?: string;
  visible: boolean;
}

// Dumb: renders the series name (a link to the series, with a small arrow saying so) + chapter title +
// optional page indicator it's given, and fires onBack (to the last screen).
export function ReaderTopBar({ seriesName, chapterTitle, pageIndicatorText, onBack, backLabel, onSeriesPress, seriesLabel, visible }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(readerTopBarStyles);
  const { topInset } = useImmersive();
  if (!visible) {return null;}

  return (
    <View style={[styles.root, { paddingTop: topInset + STATUS_BAR_GAP }]}>
      <IconButton
        icon={ChevronLeft}
        glyph="chevron"
        size={icon.size[9]}
        color={colors.icon.primary}
        onPress={onBack}
        accessibilityLabel={backLabel}
        style={styles.backButton}
        alignStroke
      />
      <View style={styles.titles}>
        <View style={styles.titlesRow}>
          {onSeriesPress != null ? (
            <Pressable style={styles.seriesLink} onPress={onSeriesPress} accessibilityRole="link" accessibilityLabel={seriesLabel}>
              <Text style={[styles.seriesName, styles.seriesShrink]} numberOfLines={1}>
                {seriesName}
              </Text>
              <ChevronRight size={icon.size[3]} color={colors.icon.secondary} />
            </Pressable>
          ) : (
            <Text style={styles.seriesName} numberOfLines={1}>
              {seriesName}
            </Text>
          )}
          {pageIndicatorText != null && (
            <Text style={styles.pageIndicator} numberOfLines={1}>
              {pageIndicatorText}
            </Text>
          )}
        </View>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {chapterTitle}
        </Text>
      </View>
    </View>
  );
}
