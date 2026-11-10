import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useStyles } from '../../../../shared/context';
import type { DashboardItem } from '../../dashboard.types';
import { RailCard } from '../rail-card';
import { RailWideCard } from '../rail-wide-card';
import { railStyles } from './rail.styles';

// A titled horizontal list of tiles. With nothing to show it is not drawn at all (an empty rail is
// noise); while its tiles are still on the way it holds their place with grey blocks, so the rail does
// not jump when they arrive. Local to the Dashboard until a second screen needs one.
export interface RailProps {
  title: string;
  items: DashboardItem[];
  onPressItem: (item: DashboardItem) => void;
  // Holding a tile (either variant). Absent = holding does nothing.
  onLongPressItem?: (item: DashboardItem) => void;
  // The tiles are still being fetched: show placeholders instead of "nothing here".
  loading?: boolean;
  // 'wide' for a rail whose taps go straight into the content, 'cover' (default) for one that opens the series.
  variant?: 'cover' | 'wide';
}

const PLACEHOLDER_TILES = [0, 1, 2];
const PLACEHOLDER_WIDE_TILES = [0, 1];

export function Rail({ title, items, onPressItem, onLongPressItem, loading = false, variant = 'cover' }: RailProps) {
  const wide = variant === 'wide';
  const styles = useStyles(railStyles);
  if (items.length === 0 && !loading) {return null;}
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {items.length === 0 && loading ? (
        <View style={styles.placeholderRow} testID="rail-placeholder">
          {wide
            ? PLACEHOLDER_WIDE_TILES.map(key => <View key={key} style={styles.placeholderWide} />)
            : PLACEHOLDER_TILES.map(key => (
                <View key={key} style={styles.placeholderTile}>
                  <View style={styles.placeholderCover} />
                  <View style={styles.placeholderName} />
                  <View style={styles.placeholderCaption} />
                </View>
              ))}
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={items}
          keyExtractor={item => item.seriesId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            wide ? (
              <RailWideCard
                id={item.seriesId}
                name={item.name}
                coverUrl={item.coverUrl}
                caption={item.caption}
                progressFraction={item.progressFraction}
                progressLabel={item.progressLabel}
                blurred={item.blurred}
                badge={item.badge}
                onPress={() => onPressItem(item)}
                onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
              />
            ) : (
              <RailCard
                id={item.seriesId}
                name={item.name}
                coverUrl={item.coverUrl}
                caption={item.caption}
                progressFraction={item.progressFraction}
                blurred={item.blurred}
                badge={item.badge}
                onPress={() => onPressItem(item)}
                onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
              />
            )
          }
        />
      )}
    </View>
  );
}
