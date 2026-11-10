import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReaderTopBar } from './reader-top-bar.component';
import { ImmersiveProvider, useImmersive } from '../../../../shared/context/immersive';
import { STATUS_BAR_GAP } from './reader-top-bar.styles';

function setup(over: Partial<React.ComponentProps<typeof ReaderTopBar>> = {}) {
  const onBack = jest.fn();
  const utils = render(
    <ReaderTopBar seriesName="One Piece" chapterTitle="Capítulo 1" onBack={onBack} backLabel="Voltar" visible {...over} />,
  );
  return { ...utils, onBack };
}

describe('ReaderTopBar', () => {
  it('renders nothing when not visible', () => {
    const { toJSON } = setup({ visible: false });
    expect(toJSON()).toBeNull();
  });

  it('renders the series name and chapter title', () => {
    const { getByText } = setup();
    expect(getByText('One Piece')).toBeTruthy();
    expect(getByText('Capítulo 1')).toBeTruthy();
  });

  it('fires onBack when the back button is pressed', () => {
    const { UNSAFE_getByType, onBack } = setup();
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the page indicator text when given one', () => {
    const { getByText } = setup({ pageIndicatorText: '3 de 10' });
    expect(getByText('3 de 10')).toBeTruthy();
  });

  it('renders no page indicator when none is given (single-page chapter)', () => {
    const { queryByText } = setup({ pageIndicatorText: undefined });
    expect(queryByText(/de/)).toBeNull();
  });

  it('makes the series name a link to the series, with its own label, when given a way to go there', () => {
    const onSeriesPress = jest.fn();
    const { getByLabelText } = setup({ onSeriesPress, seriesLabel: 'Ir para a obra' });
    fireEvent.press(getByLabelText('Ir para a obra'));
    expect(onSeriesPress).toHaveBeenCalledTimes(1);
  });

  it('leaves the series name plain when there is nowhere to go', () => {
    expect(setup().queryByRole('link')).toBeNull();
  });

  it('pads the top by the measured inset plus the gap, so the title clears the camera', () => {
    function Seed() {
      const { setTopInset } = useImmersive();
      React.useEffect(() => setTopInset(40), [setTopInset]);
      return null;
    }
    const { UNSAFE_getAllByType } = render(
      <ImmersiveProvider>
        <Seed />
        <ReaderTopBar seriesName="One Piece" chapterTitle="Capítulo 1" onBack={jest.fn()} backLabel="Voltar" visible />
      </ImmersiveProvider>,
    );
    const { View, StyleSheet } = require('react-native');
    const root = StyleSheet.flatten(UNSAFE_getAllByType(View)[0].props.style);
    expect(root.paddingTop).toBe(40 + STATUS_BAR_GAP);
  });
});
