import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../../shared/i18n/i18n.hooks', () => ({
  useStrings: () => require('../../shared/i18n/strings').getStrings('en'),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseNotificationHistory = jest.fn();
jest.mock('./notifications.hooks', () => ({
  useNotificationHistory: (...a: unknown[]) => mockUseNotificationHistory(...a),
}));

import { getStrings } from '../../shared/i18n/strings';
import { NotificationsScreen } from './notifications.screen';

const t = getStrings('en');

function historyHook(over: Partial<Record<string, unknown>> = {}) {
  return {
    loading: false,
    rows: [],
    unreadCount: 0,
    totalCount: 0,
    markRead: jest.fn().mockResolvedValue(undefined),
    markUnread: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(undefined),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn(),
    selectionMode: false,
    selectedIds: new Set<string>(),
    onRowLongPress: jest.fn(),
    onRowPress: jest.fn(),
    selectAll: jest.fn(),
    exitSelectionMode: jest.fn(),
    markSelectedRead: jest.fn().mockResolvedValue(undefined),
    markSelectedUnread: jest.fn().mockResolvedValue(undefined),
    deleteSelected: jest.fn().mockResolvedValue(undefined),
    onViewableIndices: jest.fn(),
    ...over,
  };
}

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'h1',
  ids: ['h1'],
  seriesId: 's1',
  seriesName: 'One Piece',
  chapterNumbers: [],
  bodyText: 'Chapter 1050 available',
  detectedAtMs: Date.now(),
  read: false,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNotificationHistory.mockReturnValue(historyHook());
});

describe('NotificationsScreen', () => {
  it('shows the empty message when there are no rows', () => {
    const { getByText } = render(<NotificationsScreen />);
    expect(getByText(t.notificationsHistoryEmpty)).toBeTruthy();
  });

  it('hides the mark-all-read button when there are no rows', () => {
    const { queryByText } = render(<NotificationsScreen />);
    expect(queryByText(t.notificationsHistoryMarkAllRead)).toBeNull();
  });

  it('renders a row per history item and shows mark-all-read', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1 }));
    const { getByText, queryByText } = render(<NotificationsScreen />);
    expect(getByText('One Piece')).toBeTruthy();
    expect(getByText('Chapter 1050 available')).toBeTruthy();
    expect(queryByText(t.notificationsHistoryMarkAllRead)).toBeTruthy();
  });

  it('shows unread/total when there is at least one unread notification', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], unreadCount: 1, totalCount: 3 }));
    const { getByText } = render(<NotificationsScreen />);
    expect(getByText(t.notificationsHistoryTotalCount.replace('{0}', '1').replace('{1}', '3'))).toBeTruthy();
  });

  it('shows just the total (no fraction) once everything is read', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ read: true })], unreadCount: 0, totalCount: 3 }));
    const { getByText, queryByText } = render(<NotificationsScreen />);
    expect(getByText(t.notificationsHistoryTotalCountAllRead.replace('{0}', '3'))).toBeTruthy();
    expect(queryByText(t.notificationsHistoryTotalCount.replace('{0}', '0').replace('{1}', '3'))).toBeNull();
  });

  it('hides the total count when there are no rows', () => {
    const { queryByText } = render(<NotificationsScreen />);
    expect(queryByText(/Notifications/)).toBeNull();
  });

  it('markAllRead is called when the button is pressed', () => {
    const markAllRead = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1, markAllRead }));
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText(t.notificationsHistoryMarkAllRead));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('tapping an unread row marks it read and navigates to the series detail', async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ read: false })], totalCount: 1, markRead }));
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText('One Piece'));
    await Promise.resolve();
    expect(markRead).toHaveBeenCalledWith(['h1']);
    expect(mockNavigate).toHaveBeenCalledWith('series/:seriesId', { seriesId: 's1', origin: 'LIBRARY' });
  });

  it('tapping an already-read row navigates without calling markRead again', async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ read: true })], totalCount: 1, markRead }));
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText('One Piece'));
    await Promise.resolve();
    expect(markRead).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('series/:seriesId', { seriesId: 's1', origin: 'LIBRARY' });
  });

  it('tapping a row with a single known chapter navigates straight into the reader, not the series', async () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ chapterId: 'c1' })], totalCount: 1 }));
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText('One Piece'));
    await Promise.resolve();
    expect(mockNavigate).toHaveBeenCalledWith('reader/:seriesId/:chapterId', {
      seriesId: 's1', chapterId: 'c1', origin: 'LIBRARY', seriesName: 'One Piece',
    });
  });

  it('tapping a row while in selection mode toggles selection instead of opening it', async () => {
    const onRowPress = jest.fn();
    const markRead = jest.fn();
    mockUseNotificationHistory.mockReturnValue(
      historyHook({ rows: [row()], totalCount: 1, selectionMode: true, onRowPress, markRead }),
    );
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText('One Piece'));
    await Promise.resolve();
    expect(onRowPress).toHaveBeenCalledWith('h1');
    expect(markRead).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('long-pressing a row enters selection mode', () => {
    const onRowLongPress = jest.fn();
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1, onRowLongPress }));
    const { getByText } = render(<NotificationsScreen />);
    fireEvent(getByText('One Piece'), 'longPress');
    expect(onRowLongPress).toHaveBeenCalledWith('h1');
  });

  it('shows the selection bar and selected count while in selection mode', () => {
    mockUseNotificationHistory.mockReturnValue(
      historyHook({ rows: [row()], totalCount: 1, selectionMode: true, selectedIds: new Set(['h1']) }),
    );
    const { getByText } = render(<NotificationsScreen />);
    expect(getByText('1')).toBeTruthy();
    expect(getByText(t.notificationsHistorySelectionMarkRead)).toBeTruthy();
    expect(getByText(t.notificationsHistorySelectionMarkUnread)).toBeTruthy();
    expect(getByText(t.notificationsHistorySelectionSelectAll)).toBeTruthy();
    expect(getByText(t.notificationsHistorySelectionDelete)).toBeTruthy();
  });

  it('exitSelectionMode is called from the selection top bar cancel button', () => {
    const exitSelectionMode = jest.fn();
    mockUseNotificationHistory.mockReturnValue(
      historyHook({ rows: [row()], totalCount: 1, selectionMode: true, exitSelectionMode }),
    );
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText(t.notificationsHistoryDeleteConfirmCancel));
    expect(exitSelectionMode).toHaveBeenCalledTimes(1);
  });

  it('markSelectedRead/markSelectedUnread/selectAll are wired to the selection bar', () => {
    const markSelectedRead = jest.fn();
    const markSelectedUnread = jest.fn();
    const selectAll = jest.fn();
    mockUseNotificationHistory.mockReturnValue(
      historyHook({ rows: [row()], totalCount: 1, selectionMode: true, markSelectedRead, markSelectedUnread, selectAll }),
    );
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText(t.notificationsHistorySelectionMarkRead));
    expect(markSelectedRead).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText(t.notificationsHistorySelectionMarkUnread));
    expect(markSelectedUnread).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText(t.notificationsHistorySelectionSelectAll));
    expect(selectAll).toHaveBeenCalledTimes(1);
  });

  // ── delete — always confirmed, single row or bulk ───────────────────────────
  it('tapping a row delete button opens the confirm dialog instead of deleting immediately', () => {
    const deleteItem = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1, deleteItem }));
    const { getByLabelText, getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryDelete));
    expect(deleteItem).not.toHaveBeenCalled();
    expect(getByText(t.notificationsHistoryDeleteConfirmTitleOne)).toBeTruthy();
  });

  it('confirming the single-row delete dialog calls deleteItem with that row\'s ids', () => {
    const deleteItem = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1, deleteItem }));
    const { getByLabelText, getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryDelete));
    fireEvent.press(getByText(t.notificationsHistoryDeleteConfirmConfirm));
    expect(deleteItem).toHaveBeenCalledWith(['h1']);
  });

  it('cancelling the delete dialog never calls deleteItem', () => {
    const deleteItem = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1, deleteItem }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryDelete));
    fireEvent.press(getByText(t.notificationsHistoryDeleteConfirmCancel));
    expect(deleteItem).not.toHaveBeenCalled();
    expect(queryByText(t.notificationsHistoryDeleteConfirmTitleOne)).toBeNull();
  });

  it('bulk delete from the selection bar opens the confirm dialog with the real item count behind the selected rows', () => {
    mockUseNotificationHistory.mockReturnValue(
      historyHook({
        rows: [row(), row({ id: 'h2', ids: ['h2a', 'h2b'] })],
        totalCount: 2,
        selectionMode: true,
        selectedIds: new Set(['h1', 'h2']),
      }),
    );
    const { getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText(t.notificationsHistorySelectionDelete));
    // 1 (h1) + 2 (h2's own group, h2a+h2b) = 3 real notifications, not 2 selected rows.
    expect(getByText(t.notificationsHistoryDeleteConfirmTitleMany.replace('{0}', '3'))).toBeTruthy();
  });

  it('confirming the bulk delete dialog calls deleteSelected', () => {
    const deleteSelected = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(
      historyHook({ rows: [row()], totalCount: 1, selectionMode: true, selectedIds: new Set(['h1', 'h2']), deleteSelected }),
    );
    const { getByText, getAllByText } = render(<NotificationsScreen />);
    fireEvent.press(getByText(t.notificationsHistorySelectionDelete));
    // Both the selection bar's own "Delete" button and the dialog's confirm button share the
    // same label — the dialog's is the one that renders last.
    const deleteButtons = getAllByText(t.notificationsHistoryDeleteConfirmConfirm);
    fireEvent.press(deleteButtons[deleteButtons.length - 1]);
    expect(deleteSelected).toHaveBeenCalledTimes(1);
  });

  // ── detail popup ─────────────────────────────────────────────────────────
  it('tapping the info button opens the detail popup with the row\'s own data', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ chapterNumbers: ['12', '13'] })], totalCount: 1 }));
    const { getByLabelText, getByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    expect(getByText(t.notificationsHistoryDetailTitle)).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
    expect(getByText('13')).toBeTruthy();
  });

  it('closing the detail popup hides it', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1 }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    fireEvent.press(getByText(t.notificationsHistoryDetailClose));
    expect(queryByText(t.notificationsHistoryDetailTitle)).toBeNull();
  });

  it('"go to series" from the detail popup navigates and closes it', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1 }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    fireEvent.press(getByText(t.notificationsHistoryDetailGoToSeries));
    expect(mockNavigate).toHaveBeenCalledWith('series/:seriesId', { seriesId: 's1', origin: 'LIBRARY' });
    expect(queryByText(t.notificationsHistoryDetailTitle)).toBeNull();
  });

  it('"mark unread" from the detail popup calls markUnread with the row\'s ids and closes it', async () => {
    const markUnread = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ read: true })], totalCount: 1, markUnread }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    fireEvent.press(getByText(t.notificationsHistoryDetailMarkUnread));
    await Promise.resolve();
    expect(markUnread).toHaveBeenCalledWith(['h1']);
    expect(queryByText(t.notificationsHistoryDetailTitle)).toBeNull();
  });

  it('"mark read" from the detail popup calls markRead with the row\'s ids and closes it', async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row({ read: false })], totalCount: 1, markRead }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    fireEvent.press(getByText(t.notificationsHistoryDetailMarkRead));
    await Promise.resolve();
    expect(markRead).toHaveBeenCalledWith(['h1']);
    expect(queryByText(t.notificationsHistoryDetailTitle)).toBeNull();
  });

  it('deleting from the detail popup opens the confirm dialog and closes the detail popup', () => {
    mockUseNotificationHistory.mockReturnValue(historyHook({ rows: [row()], totalCount: 1 }));
    const { getByLabelText, getByText, queryByText } = render(<NotificationsScreen />);
    fireEvent.press(getByLabelText(t.notificationsHistoryInfo));
    fireEvent.press(getByText(t.notificationsHistoryDetailDelete));
    expect(queryByText(t.notificationsHistoryDetailTitle)).toBeNull();
    expect(getByText(t.notificationsHistoryDeleteConfirmTitleOne)).toBeTruthy();
  });
});
