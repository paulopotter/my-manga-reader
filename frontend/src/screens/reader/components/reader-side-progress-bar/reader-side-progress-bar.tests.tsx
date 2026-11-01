import React from 'react';
import { PanResponder, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ReaderSideProgressBar } from './reader-side-progress-bar.component';
import { DOTS_WIDTH } from './reader-side-progress-bar.styles';
import { colors } from '../../../../shared/theme';

function setup(over: Partial<React.ComponentProps<typeof ReaderSideProgressBar>> = {}) {
  const onPageSelect = jest.fn();
  const onPrevChapter = jest.fn();
  const onNextChapter = jest.fn();
  const utils = render(
    <ReaderSideProgressBar
      totalPages={5}
      currentPage={2}
      onPageSelect={onPageSelect}
      onPrevChapter={onPrevChapter}
      onNextChapter={onNextChapter}
      hasPrev
      hasNext
      prevChapterLabel="Capítulo anterior"
      nextChapterLabel="Próximo capítulo"
      visible
      {...over}
    />,
  );
  return { ...utils, onPageSelect, onPrevChapter, onNextChapter };
}

describe('ReaderSideProgressBar', () => {
  it('renders nothing when not visible', () => {
    const { toJSON } = setup({ visible: false });
    expect(toJSON()).toBeNull();
  });

  it('renders one dot per page and selecting one fires onPageSelect with its index', () => {
    const { UNSAFE_getAllByType, onPageSelect } = setup({ totalPages: 3, currentPage: 0 });
    const { TouchableOpacity } = require('react-native');
    // order: prev arrow, dot0, dot1, dot2, next arrow
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables).toHaveLength(5);
    fireEvent.press(touchables[2]); // dot index 1
    expect(onPageSelect).toHaveBeenCalledWith(1);
  });

  it('marks the current page dot active and the pages before it as read', () => {
    // currentPage=2 exercises both the `index < currentPage` (read) and `index === currentPage`
    // (active) style branches — the active dot carries the reader's own progress colour.
    const { toJSON } = setup({ totalPages: 5, currentPage: 2 });
    expect(JSON.stringify(toJSON())).toContain(colors.progress.reading.primary);
  });

  it('arrows call their callbacks when enabled', () => {
    const { getByLabelText, onPrevChapter, onNextChapter } = setup();
    fireEvent.press(getByLabelText('Capítulo anterior'));
    fireEvent.press(getByLabelText('Próximo capítulo'));
    expect(onPrevChapter).toHaveBeenCalledTimes(1);
    expect(onNextChapter).toHaveBeenCalledTimes(1);
  });

  it('disabled arrows do not call their callbacks even if pressed', () => {
    const { getByLabelText, onPrevChapter, onNextChapter } = setup({ hasPrev: false, hasNext: false });
    fireEvent.press(getByLabelText('Capítulo anterior'));
    fireEvent.press(getByLabelText('Próximo capítulo'));
    expect(onPrevChapter).not.toHaveBeenCalled();
    expect(onNextChapter).not.toHaveBeenCalled();
  });
});

describe('ReaderSideProgressBar — a chapter with more pages than dots fit', () => {
  // The pill is 120 tall: 13 dots fit, and the scrubber's track travels 100 (120 - 2 * 3 padding - 14 thumb).
  const layout = { nativeEvent: { layout: { height: 120, width: 28, x: 0, y: 0 } } };
  let config: Parameters<typeof PanResponder.create>[0];

  beforeEach(() => {
    jest.spyOn(PanResponder, 'create').mockImplementation(c => {
      config = c;
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  function setupScrubber(over: Partial<React.ComponentProps<typeof ReaderSideProgressBar>> = {}) {
    const utils = setup({ totalPages: 50, currentPage: 10, ...over });
    act(() => {
      fireEvent(utils.getByTestId('reader-side-progress-bar-pill'), 'layout', layout);
    });
    return utils;
  }

  const touch = (locationY: number) => ({ nativeEvent: { locationY } }) as never;

  it('keeps one dot per page until the bar has been measured', () => {
    const { UNSAFE_getAllByType, queryByTestId } = setup({ totalPages: 50 });
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_getAllByType(TouchableOpacity)).toHaveLength(52);
    expect(queryByTestId('reader-side-progress-bar-scrubber')).toBeNull();
  });

  it('keeps the dots when they fit the measured height', () => {
    const { UNSAFE_getAllByType, queryByTestId } = setupScrubber({ totalPages: 13 });
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_getAllByType(TouchableOpacity)).toHaveLength(15);
    expect(queryByTestId('reader-side-progress-bar-scrubber')).toBeNull();
  });

  it('swaps the dots for the scrubber when they do not fit', () => {
    const { UNSAFE_getAllByType, getByTestId } = setupScrubber();
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_getAllByType(TouchableOpacity)).toHaveLength(2); // only the two arrows remain
    expect(getByTestId('reader-side-progress-bar-scrubber')).toBeTruthy();
  });

  it('keeps the bubble on one line and wider than the pill, so a long count is not broken per character', () => {
    const { getByText, getByTestId } = setupScrubber();

    act(() => config.onPanResponderGrant?.(touch(10), {} as never));

    expect(getByText('1 / 50').props.numberOfLines).toBe(1);
    // The bubble sits in a row wider than the pill: an absolute child is only as wide as its parent.
    expect(StyleSheet.flatten(getByTestId('reader-side-progress-bar-bubble-row').props.style).width).toBeGreaterThan(DOTS_WIDTH);
  });

  it('names the page under the finger while dragging, and jumps there on release only', () => {
    const { getByText, queryByText, onPageSelect } = setupScrubber();

    act(() => config.onPanResponderGrant?.(touch(10), {} as never)); // top of the track → page 1
    expect(getByText('1 / 50')).toBeTruthy();

    act(() => config.onPanResponderMove?.(touch(0), { dy: 50 } as never)); // 10 + 50 = 60 → halfway down the track → index 25 (24.5 rounds up)
    expect(getByText('26 / 50')).toBeTruthy();
    expect(onPageSelect).not.toHaveBeenCalled();

    act(() => config.onPanResponderRelease?.(touch(0), {} as never));
    expect(onPageSelect).toHaveBeenCalledTimes(1);
    expect(onPageSelect).toHaveBeenCalledWith(25);
    expect(queryByText(/\/ 50$/)).toBeNull();
  });

  it('a tap without moving jumps to the page it landed on', () => {
    const { onPageSelect } = setupScrubber();
    act(() => config.onPanResponderGrant?.(touch(110), {} as never)); // bottom of the track → last page
    act(() => config.onPanResponderRelease?.(touch(110), {} as never));
    expect(onPageSelect).toHaveBeenCalledWith(49);
  });

  it('clamps a drag that leaves the pill', () => {
    const { onPageSelect } = setupScrubber();
    act(() => config.onPanResponderGrant?.(touch(60), {} as never));
    act(() => config.onPanResponderMove?.(touch(0), { dy: -500 } as never));
    act(() => config.onPanResponderRelease?.(touch(0), {} as never));
    expect(onPageSelect).toHaveBeenCalledWith(0);
  });

  it('drops the bubble without jumping when the gesture is taken away', () => {
    const { queryByText, onPageSelect } = setupScrubber();
    act(() => config.onPanResponderGrant?.(touch(60), {} as never));
    act(() => config.onPanResponderTerminate?.(touch(60), {} as never));
    expect(queryByText(/\/ 50$/)).toBeNull();
    expect(onPageSelect).not.toHaveBeenCalled();
  });

  it('never lets another view take the gesture mid-drag', () => {
    setupScrubber();
    expect(config.onPanResponderTerminationRequest?.({} as never, {} as never)).toBe(false);
    expect(config.onStartShouldSetPanResponder?.({} as never, {} as never)).toBe(true);
    expect(config.onMoveShouldSetPanResponder?.({} as never, {} as never)).toBe(true);
  });
});
