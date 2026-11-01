import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RailWideCard } from './rail-wide-card.component';

const base = { id: 's1', name: 'Leveling with Gods', coverUrl: 'c', onPress: jest.fn() };

describe('RailWideCard', () => {
  it('shows the name, where the reader is, and the progress as a bar and words', () => {
    const { getByText, getByTestId } = render(
      <RailWideCard {...base} caption="Cap. 12" progressFraction={0.45} progressLabel="45% lido" />,
    );
    expect(getByText('Leveling with Gods')).toBeTruthy();
    expect(getByText('Cap. 12')).toBeTruthy();
    expect(getByText('45% lido')).toBeTruthy();
    expect(getByTestId('rail-wide-card-progress')).toBeTruthy();
  });

  it('has no bar or words when there is no progress to tell', () => {
    const { queryByTestId, queryByText } = render(<RailWideCard {...base} caption="Cap. 1" />);
    expect(queryByTestId('rail-wide-card-progress')).toBeNull();
    expect(queryByText(/lido/)).toBeNull();
  });

  it('badges a novel beside the caption, and only then', () => {
    const { getByText, queryByTestId, rerender } = render(<RailWideCard {...base} badge="Novel" />);
    expect(getByText('Novel')).toBeTruthy();
    rerender(<RailWideCard {...base} />);
    expect(queryByTestId('rail-wide-card-badge')).toBeNull();
  });

  it('reports the press with its id', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<RailWideCard {...base} onPress={onPress} />);
    fireEvent.press(getByTestId('rail-wide-card'));
    expect(onPress).toHaveBeenCalledWith('s1');
  });

  it('reports a long press with its id, and holding does nothing without a handler', () => {
    const onLongPress = jest.fn();
    const { getByTestId, rerender } = render(<RailWideCard {...base} onLongPress={onLongPress} />);
    fireEvent(getByTestId('rail-wide-card'), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith('s1');
    rerender(<RailWideCard {...base} />);
    expect(getByTestId('rail-wide-card').props.onLongPress).toBeUndefined();
  });

  it('blurs the cover and the texts only when asked', () => {
    const { Image } = require('react-native');
    const { UNSAFE_getByType, getByText, rerender } = render(<RailWideCard {...base} caption="Cap. 3" />);
    expect(UNSAFE_getByType(Image).props.blurRadius).toBe(0);
    rerender(<RailWideCard {...base} caption="Cap. 3" blurred />);
    expect(UNSAFE_getByType(Image).props.blurRadius).toBeGreaterThan(0);
    expect(JSON.stringify(getByText('Leveling with Gods').props.style)).toContain('transparent');
  });
});
