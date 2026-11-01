import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { useStyles, useTheme } from '../../../../shared/context';
import { blur, icon } from '../../../../shared/theme';
import { railWideCardStyles } from './rail-wide-card.styles';

// The tile of a rail whose taps go straight into the content (reading): wider than a cover tile on
// purpose, so the two are never mistaken for each other. Dumb: primitives + one callback, every text
// already localized.
export interface RailWideCardProps {
  id: string;
  name: string;
  coverUrl: string;
  // Where the reader is / what comes next ("Cap. 12").
  caption?: string;
  progressFraction?: number;
  // "45% lido", beside the bar.
  progressLabel?: string;
  blurred?: boolean;
  // "Novel" / "PDF".
  badge?: string;
  onPress: (id: string) => void;
  // Holding the tile (hide it from the rail). Absent → holding does nothing.
  onLongPress?: (id: string) => void;
}

export const RailWideCard = React.memo(function RailWideCard({
  id,
  name,
  coverUrl,
  caption,
  progressFraction,
  progressLabel,
  blurred,
  badge,
  onPress,
  onLongPress,
}: RailWideCardProps) {
  const styles = useStyles(railWideCardStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(id)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
      activeOpacity={0.8}
      testID="rail-wide-card">
      <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" blurRadius={blurred ? blur.cover : 0} />
      <View style={styles.body}>
        <Text style={[styles.name, blurred && styles.textBlurred]} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.captionRow}>
          {caption != null && (
            <Text style={[styles.caption, blurred && styles.textBlurred]} numberOfLines={1}>
              {caption}
            </Text>
          )}
          {badge != null && (
            <View style={styles.badge} testID="rail-wide-card-badge">
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          {progressFraction != null ? (
            <>
              <View style={styles.progressBar} testID="rail-wide-card-progress">
                <View style={[styles.progressFill, { width: `${Math.round(progressFraction * 100)}%` }]} />
              </View>
              {progressLabel != null && <Text style={styles.progressLabel}>{progressLabel}</Text>}
            </>
          ) : (
            <View style={styles.progressBar} />
          )}
          <Play size={icon.size[5]} color={colors.icon.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
});
