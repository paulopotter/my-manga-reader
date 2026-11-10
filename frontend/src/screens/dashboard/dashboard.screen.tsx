import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActionDialog } from '../../shared/components/action-dialog';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { useStrings } from '../../shared/i18n';
import { useStyles, useTheme } from '../../shared/context';
import { Routes } from '../../navigation/routes';
import { Rail } from './components/rail';
import { StatsStrip } from './components/stats-strip';
import { useDashboard } from './hooks';
import { dashboardStyles } from './dashboard.styles';
import type { DashboardItem } from './dashboard.types';

// dashboard.screen.tsx — render + navigation only. Rails come from useDashboard; a tile on
// "continue reading" opens the reader on its chapter, any other opens the series. Holding a tile of
// "continue reading" or "not finished yet" offers to go to the series or to hide it from those rails
// until it is read again — after one more confirmation.
export function DashboardScreen() {
  const styles = useStyles(dashboardStyles);
  const { colors } = useTheme();
  const t = useStrings();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { status, data, refreshing, continueLoading, followedLoading, refresh, retry, hideContinue } = useDashboard();
  // The tile whose menu is open; null = no menu.
  const [menuItem, setMenuItem] = useState<DashboardItem | null>(null);
  // The tile waiting for the "hide it?" confirmation; null = none.
  const [pendingHide, setPendingHide] = useState<DashboardItem | null>(null);

  const open = useCallback(
    (item: DashboardItem) => {
      if (item.chapterId) {
        navigation.navigate(Routes.READER, { seriesId: item.seriesId, chapterId: item.chapterId, origin: 'DASHBOARD' });
      } else {
        navigation.navigate(Routes.SERIES_DETAIL, { seriesId: item.seriesId, origin: 'DASHBOARD' });
      }
    },
    [navigation],
  );

  const goToSeries = useCallback(() => {
    if (!menuItem) {return;}
    const { seriesId } = menuItem;
    setMenuItem(null);
    navigation.navigate(Routes.SERIES_DETAIL, { seriesId, origin: 'DASHBOARD' });
  }, [menuItem, navigation]);

  const askHide = useCallback(() => {
    setPendingHide(menuItem);
    setMenuItem(null);
  }, [menuItem]);

  const confirmHide = useCallback(() => {
    if (!pendingHide) {return;}
    const { seriesId } = pendingHide;
    setPendingHide(null);
    hideContinue({ seriesId });
  }, [pendingHide, hideContinue]);

  if (status === 'loading' || (status === 'ready' && !data)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.button.primary} />
      </View>
    );
  }

  if (status === 'error' || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t.dashboardError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryText}>{t.dashboardRetry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <StatsStrip stats={data.stats} />
      <Rail
        title={t.dashboardContinueReading}
        items={data.continueReading}
        loading={continueLoading}
        variant="wide"
        onPressItem={open}
        onLongPressItem={setMenuItem}
      />
      <Rail title={t.dashboardFollowedUpdated} items={data.followedUpdated} loading={followedLoading} onPressItem={open} />
      <Rail title={t.dashboardUnfinished} items={data.unfinished} onPressItem={open} onLongPressItem={setMenuItem} />
      <Rail title={t.dashboardRecentlyUpdated} items={data.recentlyUpdated} onPressItem={open} />
      <Rail title={t.dashboardRecentlyAdded} items={data.recentlyAdded} onPressItem={open} />
      <ActionDialog
        visible={menuItem != null}
        title={menuItem?.name ?? ''}
        message={t.dashboardMenuHideHint}
        actions={[
          { key: 'go', label: t.dashboardMenuGoToSeries, onPress: goToSeries },
          { key: 'hide', label: t.dashboardMenuHide, onPress: askHide },
        ]}
        cancelLabel={t.dashboardMenuCancel}
        onCancel={() => setMenuItem(null)}
      />
      <ConfirmDialog
        visible={pendingHide != null}
        title={t.dashboardHideConfirmTitle.replace('{0}', pendingHide?.name ?? '')}
        cancelLabel={t.dashboardMenuCancel}
        confirmLabel={t.dashboardMenuHide}
        onCancel={() => setPendingHide(null)}
        onConfirm={confirmHide}
      />
    </ScrollView>
  );
}
