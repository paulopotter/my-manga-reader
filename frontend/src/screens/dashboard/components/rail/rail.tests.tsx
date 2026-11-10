import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../../../../shared/i18n', () => ({
  useStrings: () => require('../../../../shared/i18n/strings').getStrings('en'),
}));

import { Rail } from './rail.component';

const item = { seriesId: 's1', name: 'One Piece', coverUrl: 'c', caption: 'Ch. 3' };

describe('Rail', () => {
  it('is not drawn at all when it has nothing to show', () => {
    const { toJSON } = render(<Rail title="Continue" items={[]} onPressItem={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the tiles and hands the pressed item back', () => {
    const onPressItem = jest.fn();
    const { getByText } = render(<Rail title="Continue" items={[item]} onPressItem={onPressItem} />);
    fireEvent.press(getByText('One Piece'));
    expect(onPressItem).toHaveBeenCalledWith(item);
  });

  it('holds the place of its tiles while they load, instead of saying there is nothing', () => {
    const { getByTestId, getByText } = render(<Rail title="Continue" items={[]} loading onPressItem={jest.fn()} />);
    expect(getByTestId('rail-placeholder')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('shows the tiles it already has even while it is still loading', () => {
    const { getByText, queryByTestId } = render(<Rail title="Continue" items={[item]} loading onPressItem={jest.fn()} />);
    expect(getByText('One Piece')).toBeTruthy();
    expect(queryByTestId('rail-placeholder')).toBeNull();
  });

  it('draws the wide card for a rail that goes straight into the content', () => {
    const { getByTestId, queryByTestId, rerender } = render(<Rail title="Continue" items={[item]} variant="wide" onPressItem={jest.fn()} />);
    expect(getByTestId('rail-wide-card')).toBeTruthy();
    rerender(<Rail title="Continue" items={[item]} onPressItem={jest.fn()} />);
    expect(queryByTestId('rail-wide-card')).toBeNull();
  });

  it('holds the place of a wide rail with wide blocks', () => {
    const { getByTestId } = render(<Rail title="Continue" items={[]} loading variant="wide" onPressItem={jest.fn()} />);
    expect(getByTestId('rail-placeholder')).toBeTruthy();
  });

  it('hands the held item back from a wide tile', () => {
    const onLongPressItem = jest.fn();
    const { getByTestId } = render(
      <Rail title="Continue" items={[item]} variant="wide" onPressItem={jest.fn()} onLongPressItem={onLongPressItem} />,
    );
    fireEvent(getByTestId('rail-wide-card'), 'longPress');
    expect(onLongPressItem).toHaveBeenCalledWith(item);
  });

  it('leaves holding a wide tile without a handler to do nothing', () => {
    const { getByTestId } = render(<Rail title="Continue" items={[item]} variant="wide" onPressItem={jest.fn()} />);
    expect(getByTestId('rail-wide-card').props.onLongPress).toBeUndefined();
  });

  it('hands the held item back from a cover tile too, and does nothing without a handler', () => {
    const onLongPressItem = jest.fn();
    const { getByText, rerender } = render(<Rail title="Recent" items={[item]} onPressItem={jest.fn()} onLongPressItem={onLongPressItem} />);
    fireEvent(getByText('One Piece'), 'longPress');
    expect(onLongPressItem).toHaveBeenCalledWith(item);
    rerender(<Rail title="Recent" items={[item]} onPressItem={jest.fn()} />);
    fireEvent(getByText('One Piece'), 'longPress');
    expect(onLongPressItem).toHaveBeenCalledTimes(1);
  });
});
