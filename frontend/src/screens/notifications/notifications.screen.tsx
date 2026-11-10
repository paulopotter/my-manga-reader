import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { ViewToken } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, SquareCheckBig, Trash2, X } from 'lucide-react-native';
import { Routes } from '../../navigation/routes';
import { useStrings } from '../../shared/i18n';
import { DateTool } from '../../shared/tools/date';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { SelectionBottomBar } from '../../shared/components/selection-bottom-bar';
import { HistoryItem } from './components/history-item';
import { DetailModal } from './components/detail-modal';
import { useNotificationHistory } from './notifications.hooks';
import { notificationsStyles } from './notifications.styles';
import type { NotificationHistoryRow } from './notifications.types';
import { useStyles } from '../../shared/context';

// The in-app notification history — a tab of its own (MainNavigator), reachable independently of
// where the user came from, so it always returns to the Library tab when opening a series/reader
// (no NavOrigin variant exists for "from the notifications tab" and adding one isn't worth it for
// a single fallback destination).
export function NotificationsScreen() {
  const styles = useStyles(notificationsStyles);
  const t = useStrings();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const {
    loading,
    rows,
    unreadCount,
    totalCount,
    markRead,
    markUnread,
    markAllRead,
    deleteItem,
    selectionMode,
    selectedIds,
    onRowLongPress,
    onRowPress,
    selectAll,
    exitSelectionMode,
    markSelectedRead,
    markSelectedUnread,
    deleteSelected,
    onViewableIndices,
  } = useNotificationHistory();

  // A single pending delete (row id + its real item ids) drives the confirm dialog for BOTH the
  // per-row delete and the bulk one — same dialog, same "always confirm" rule (see
  // notifications.hooks.ts's deleteItem/deleteSelected). `null` = dialog hidden.
  const [pendingDelete, setPendingDelete] = useState<{ count: number; run: () => Promise<void> } | null>(null);
  const [detailRow, setDetailRow] = useState<NotificationHistoryRow | null>(null);

  const goToSeries = useCallback(
    (row: NotificationHistoryRow) => {
      navigation.navigate(Routes.SERIES_DETAIL, { seriesId: row.seriesId, origin: 'LIBRARY' });
    },
    [navigation],
  );

  const openItem = useCallback(
    async (row: NotificationHistoryRow) => {
      if (selectionMode) {
        onRowPress(row.id);
        return;
      }
      if (!row.read) {await markRead(row.ids);}
      if (row.chapterId) {
        navigation.navigate(Routes.READER, { seriesId: row.seriesId, chapterId: row.chapterId, origin: 'LIBRARY', seriesName: row.seriesName });
      } else {
        goToSeries(row);
      }
    },
    [selectionMode, onRowPress, markRead, navigation, goToSeries],
  );

  const askDeleteOne = useCallback((row: NotificationHistoryRow) => {
    setPendingDelete({ count: 1, run: () => deleteItem(row.ids) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Counts real items, not selected rows — a selected group row stands for 2+ real notifications
  // (see notifications.types.ts's own doc on `ids`), and the confirm dialog's title should say
  // how many notifications are actually being deleted.
  const askDeleteSelected = useCallback(() => {
    const count = rows.filter(r => selectedIds.has(r.id)).reduce((sum, r) => sum + r.ids.length, 0);
    setPendingDelete({ count, run: deleteSelected });
  }, [rows, selectedIds, deleteSelected]);

  const confirmDelete = useCallback(() => {
    const pending = pendingDelete;
    setPendingDelete(null);
    pending?.run();
  }, [pendingDelete]);

  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 0 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length === 0) {return;}
    const indices = viewableItems.map(v => v.index).filter((i): i is number => i != null);
    onViewableIndices(Math.min(...indices), Math.max(...indices));
  });

  return (
    <View style={styles.root}>
      {selectionMode ? (
        <View style={styles.selectionTopBar}>
          <Text style={styles.selectionCount}>{selectedIds.size}</Text>
          <TouchableOpacity style={styles.markAllBtn} onPress={exitSelectionMode}>
            <Text style={styles.selectionCancelTxt}>{t.notificationsHistoryDeleteConfirmCancel}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.topBar}>
          {totalCount > 0 && (
            <Text style={styles.totalCount}>
              {unreadCount > 0
                ? t.notificationsHistoryTotalCount.replace('{0}', String(unreadCount)).replace('{1}', String(totalCount))
                : t.notificationsHistoryTotalCountAllRead.replace('{0}', String(totalCount))}
            </Text>
          )}
          {rows.length > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <Text style={styles.markAllTxt}>{t.notificationsHistoryMarkAllRead}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!loading && rows.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.message}>{t.notificationsHistoryEmpty}</Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={row => row.id}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfigRef.current}
        renderItem={({ item }) => (
          <HistoryItem
            seriesName={item.seriesName}
            bodyText={item.bodyText}
            timestampLabel={DateTool.format.to.relative(item.detectedAtMs, t)}
            read={item.read}
            coverUrl={item.coverUrl}
            blurred={item.blurred}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() => openItem(item)}
            onLongPress={() => onRowLongPress(item.id)}
            onDelete={() => askDeleteOne(item)}
            onInfo={() => setDetailRow(item)}
            deleteLabel={t.notificationsHistoryDelete}
            infoLabel={t.notificationsHistoryInfo}
          />
        )}
      />

      {selectionMode && (
        <SelectionBottomBar
          actions={[
            { key: 'select-all', icon: SquareCheckBig, label: t.notificationsHistorySelectionSelectAll, onPress: selectAll },
            { key: 'mark-read', icon: Check, label: t.notificationsHistorySelectionMarkRead, onPress: markSelectedRead },
            { key: 'mark-unread', icon: X, label: t.notificationsHistorySelectionMarkUnread, onPress: markSelectedUnread },
            { key: 'delete', icon: Trash2, label: t.notificationsHistorySelectionDelete, onPress: askDeleteSelected },
          ]}
        />
      )}

      <ConfirmDialog
        visible={pendingDelete != null}
        title={
          pendingDelete && pendingDelete.count > 1
            ? t.notificationsHistoryDeleteConfirmTitleMany.replace('{0}', String(pendingDelete.count))
            : t.notificationsHistoryDeleteConfirmTitleOne
        }
        cancelLabel={t.notificationsHistoryDeleteConfirmCancel}
        confirmLabel={t.notificationsHistoryDeleteConfirmConfirm}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {detailRow && (
        <DetailModal
          visible
          title={t.notificationsHistoryDetailTitle}
          chaptersTitle={t.notificationsHistoryDetailChaptersTitle}
          seriesName={detailRow.seriesName}
          bodyText={detailRow.bodyText}
          timestampLabel={DateTool.format.to.full(detailRow.detectedAtMs)}
          chapterNumbers={detailRow.chapterNumbers}
          coverUrl={detailRow.coverUrl}
          read={detailRow.read}
          goToSeriesLabel={t.notificationsHistoryDetailGoToSeries}
          markReadLabel={t.notificationsHistoryDetailMarkRead}
          markUnreadLabel={t.notificationsHistoryDetailMarkUnread}
          deleteLabel={t.notificationsHistoryDetailDelete}
          closeLabel={t.notificationsHistoryDetailClose}
          onGoToSeries={() => {
            goToSeries(detailRow);
            setDetailRow(null);
          }}
          onMarkRead={async () => {
            const row = detailRow;
            setDetailRow(null);
            await markRead(row.ids);
          }}
          onMarkUnread={async () => {
            const row = detailRow;
            setDetailRow(null);
            await markUnread(row.ids);
          }}
          onDelete={() => {
            setPendingDelete({ count: detailRow.ids.length, run: () => deleteItem(detailRow.ids) });
            setDetailRow(null);
          }}
          onClose={() => setDetailRow(null)}
        />
      )}
    </View>
  );
}
