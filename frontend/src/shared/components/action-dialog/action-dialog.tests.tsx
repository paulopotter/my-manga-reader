import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ActionDialog } from './action-dialog.component';

describe('ActionDialog', () => {
  const base = { visible: true, title: 'One Piece', cancelLabel: 'Cancelar', onCancel: jest.fn() };

  it('draws the title, the optional message and one button per action', () => {
    const { getByText } = render(
      <ActionDialog {...base} message="Volta quando ler de novo" actions={[{ key: 'a', label: 'Ir', onPress: jest.fn() }, { key: 'b', label: 'Esconder', onPress: jest.fn() }]} />,
    );
    expect(getByText('One Piece')).toBeTruthy();
    expect(getByText('Volta quando ler de novo')).toBeTruthy();
    expect(getByText('Ir')).toBeTruthy();
    expect(getByText('Esconder')).toBeTruthy();
  });

  it('calls the pressed action and the cancel separately', () => {
    const onA = jest.fn();
    const onB = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(
      <ActionDialog {...base} onCancel={onCancel} actions={[{ key: 'a', label: 'Ir', onPress: onA }, { key: 'b', label: 'Esconder', onPress: onB }]} />,
    );
    fireEvent.press(getByText('Esconder'));
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onA).not.toHaveBeenCalled();
    fireEvent.press(getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has no message line when none is given', () => {
    const { queryByText } = render(<ActionDialog {...base} actions={[]} />);
    expect(queryByText('Volta quando ler de novo')).toBeNull();
  });
});
