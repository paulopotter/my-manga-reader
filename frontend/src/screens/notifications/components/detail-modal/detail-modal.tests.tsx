import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DetailModal } from './detail-modal.component';

const baseProps = {
  visible: true,
  title: 'Detalhes',
  chaptersTitle: 'Capítulos incluídos',
  seriesName: 'One Piece',
  bodyText: '3 novos capítulos disponíveis',
  timestampLabel: '14/09/2026 10:00',
  chapterNumbers: [],
  read: false,
  goToSeriesLabel: 'Ir para a série',
  markReadLabel: 'Marcar como lido',
  markUnreadLabel: 'Marcar como não lido',
  deleteLabel: 'Excluir',
  closeLabel: 'Fechar',
  onGoToSeries: jest.fn(),
  onMarkRead: jest.fn(),
  onMarkUnread: jest.fn(),
  onDelete: jest.fn(),
  onClose: jest.fn(),
};

describe('DetailModal', () => {
  it('renders series info and timestamp', () => {
    const { getByText } = render(<DetailModal {...baseProps} />);
    expect(getByText('One Piece')).toBeTruthy();
    expect(getByText('3 novos capítulos disponíveis')).toBeTruthy();
    expect(getByText('14/09/2026 10:00')).toBeTruthy();
  });

  it('lists every chapter number when the row is a group', () => {
    const { getByText } = render(<DetailModal {...baseProps} chapterNumbers={['12', '13', '14']} />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('13')).toBeTruthy();
    expect(getByText('14')).toBeTruthy();
  });

  it('does not render the chapters section when there are none', () => {
    const { queryByText } = render(<DetailModal {...baseProps} chapterNumbers={[]} />);
    expect(queryByText(baseProps.chaptersTitle)).toBeNull();
  });

  it('shows mark-unread when the row is read and mark-read when it is not', () => {
    const { queryByText, rerender } = render(<DetailModal {...baseProps} read={false} />);
    expect(queryByText(baseProps.markUnreadLabel)).toBeNull();
    expect(queryByText(baseProps.markReadLabel)).toBeTruthy();

    rerender(<DetailModal {...baseProps} read />);
    expect(queryByText(baseProps.markUnreadLabel)).toBeTruthy();
    expect(queryByText(baseProps.markReadLabel)).toBeNull();
  });

  it('calls onMarkRead from its own button', () => {
    const onMarkRead = jest.fn();
    const { getByText } = render(<DetailModal {...baseProps} read={false} onMarkRead={onMarkRead} />);
    fireEvent.press(getByText(baseProps.markReadLabel));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it('calls onGoToSeries, onDelete and onClose from their own buttons', () => {
    const onGoToSeries = jest.fn();
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(<DetailModal {...baseProps} onGoToSeries={onGoToSeries} onDelete={onDelete} onClose={onClose} />);

    fireEvent.press(getByText(baseProps.goToSeriesLabel));
    expect(onGoToSeries).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText(baseProps.deleteLabel));
    expect(onDelete).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText(baseProps.closeLabel));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onMarkUnread when read and the action is pressed', () => {
    const onMarkUnread = jest.fn();
    const { getByText } = render(<DetailModal {...baseProps} read onMarkUnread={onMarkUnread} />);
    fireEvent.press(getByText(baseProps.markUnreadLabel));
    expect(onMarkUnread).toHaveBeenCalledTimes(1);
  });
});
