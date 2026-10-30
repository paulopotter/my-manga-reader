import { dotCapacity, fitsAsDots, fractionOfPage, pageAtOffset } from './reader-side-progress-bar.scrubber';

const base = { dotSize: 6, gap: 3, padding: 3 };

describe('dotCapacity', () => {
  it('counts n dots as n * dotSize + (n - 1) * gap', () => {
    // 10 dots take 10 * 6 + 9 * 3 = 87, plus 2 * 3 of padding = 93
    expect(dotCapacity({ ...base, height: 93 })).toBe(10);
    expect(dotCapacity({ ...base, height: 92 })).toBe(9);
  });

  it('is zero when the bar is shorter than its own padding', () => {
    expect(dotCapacity({ ...base, height: 0 })).toBe(0);
    expect(dotCapacity({ ...base, height: 2 })).toBe(0);
  });
});

describe('fitsAsDots', () => {
  it('keeps the dots while the bar is unmeasured', () => {
    expect(fitsAsDots({ ...base, totalPages: 500, height: null })).toBe(true);
  });

  it('keeps the dots up to the capacity and hands over to the scrubber past it', () => {
    expect(fitsAsDots({ ...base, totalPages: 10, height: 93 })).toBe(true);
    expect(fitsAsDots({ ...base, totalPages: 11, height: 93 })).toBe(false);
  });
});

describe('pageAtOffset', () => {
  it('maps the track linearly onto the pages', () => {
    expect(pageAtOffset({ offset: 0, trackHeight: 100, totalPages: 11 })).toBe(0);
    expect(pageAtOffset({ offset: 50, trackHeight: 100, totalPages: 11 })).toBe(5);
    expect(pageAtOffset({ offset: 100, trackHeight: 100, totalPages: 11 })).toBe(10);
  });

  it('clamps a touch that left the track', () => {
    expect(pageAtOffset({ offset: -40, trackHeight: 100, totalPages: 11 })).toBe(0);
    expect(pageAtOffset({ offset: 400, trackHeight: 100, totalPages: 11 })).toBe(10);
  });

  it('is page 0 for a single page or an unmeasured track', () => {
    expect(pageAtOffset({ offset: 30, trackHeight: 100, totalPages: 1 })).toBe(0);
    expect(pageAtOffset({ offset: 30, trackHeight: 0, totalPages: 11 })).toBe(0);
  });
});

describe('fractionOfPage', () => {
  it('puts the first page at 0 and the last at 1', () => {
    expect(fractionOfPage({ page: 0, totalPages: 11 })).toBe(0);
    expect(fractionOfPage({ page: 5, totalPages: 11 })).toBe(0.5);
    expect(fractionOfPage({ page: 10, totalPages: 11 })).toBe(1);
  });

  it('is 0 for a single page and clamps an out-of-range page', () => {
    expect(fractionOfPage({ page: 3, totalPages: 1 })).toBe(0);
    expect(fractionOfPage({ page: 99, totalPages: 11 })).toBe(1);
    expect(fractionOfPage({ page: -2, totalPages: 11 })).toBe(0);
  });
});
