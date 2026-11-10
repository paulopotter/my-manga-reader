import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { actionDialogStyles } from './action-dialog.styles';

import { useStyles } from '../../context';

export interface ActionDialogAction {
  key: string;
  label: string;
  onPress: () => void;
}

export interface ActionDialogProps {
  visible: boolean;
  title: string;
  // A line under the title (what the actions will do), optional.
  message?: string;
  actions: ActionDialogAction[];
  cancelLabel: string;
  onCancel: () => void;
}

// A modal that lists a few actions one per row, plus a cancel — the multi-choice sibling of
// ConfirmDialog (same backdrop + card). A screen owns WHEN to show it and WHAT each action does.
export function ActionDialog({ visible, title, message, actions, cancelLabel, onCancel }: ActionDialogProps) {
  const styles = useStyles(actionDialogStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {message != null && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            {actions.map(action => (
              <Pressable key={action.key} style={[styles.btn, styles.btnPrimary]} onPress={action.onPress}>
                <Text style={styles.btnLabelPrimary}>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancel}>
              <Text style={styles.btnLabelSecondary}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
