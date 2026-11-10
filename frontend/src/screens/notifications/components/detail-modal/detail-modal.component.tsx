import React from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { detailModalStyles } from './detail-modal.styles';
import { useStyles } from '../../../../shared/context';

export interface DetailModalProps {
  visible: boolean;
  title: string;
  chaptersTitle: string;
  seriesName: string;
  bodyText: string;
  timestampLabel: string;
  chapterNumbers: string[];
  coverUrl?: string;
  read: boolean;
  goToSeriesLabel: string;
  markReadLabel: string;
  markUnreadLabel: string;
  deleteLabel: string;
  closeLabel: string;
  onGoToSeries: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// The notification history's own "more information" popup — full series name (no truncation),
// the cover in bigger form, the exact timestamp (the list row only shows a relative one), every
// chapter number a collapsed group stands for, and the same actions the row already offers
// (repeated here for convenience, per the user's own request) plus mark-as-read / mark-as-unread
// (whichever applies to the row's state), which the list row doesn't expose directly (only via
// long-press selection).
export function DetailModal({
  visible,
  title,
  chaptersTitle,
  seriesName,
  bodyText,
  timestampLabel,
  chapterNumbers,
  coverUrl,
  read,
  goToSeriesLabel,
  markReadLabel,
  markUnreadLabel,
  deleteLabel,
  closeLabel,
  onGoToSeries,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onClose,
}: DetailModalProps) {
  const styles = useStyles(detailModalStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.header}>
            {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />}
            <View style={styles.headerInfo}>
              <Text style={styles.seriesName}>{seriesName}</Text>
              <Text style={styles.bodyText}>{bodyText}</Text>
              <Text style={styles.timestamp}>{timestampLabel}</Text>
            </View>
          </View>

          {chapterNumbers.length > 0 && (
            <View style={styles.chaptersSection}>
              <Text style={styles.chaptersTitle}>{chaptersTitle}</Text>
              <ScrollView style={styles.chaptersList}>
                {chapterNumbers.map((number, index) => (
                  <Text key={`${number}-${index}`} style={styles.chapterRow}>
                    {number}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={onGoToSeries}>
              <Text style={styles.actionLabelSecondary}>{goToSeriesLabel}</Text>
            </Pressable>
            {read ? (
              <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={onMarkUnread}>
                <Text style={styles.actionLabelSecondary}>{markUnreadLabel}</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={onMarkRead}>
                <Text style={styles.actionLabelSecondary}>{markReadLabel}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={onDelete}>
              <Text style={styles.actionLabelDanger}>{deleteLabel}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeLabel}>{closeLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
