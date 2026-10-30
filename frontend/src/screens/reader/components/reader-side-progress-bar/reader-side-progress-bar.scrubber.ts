// Pure maths for the side bar's two shapes: one dot per page while they fit, a draggable scrubber
// once they don't. No React, no layout — the component feeds it the measured height.

/**
 * How many dots fit in `height`, each `dotSize` wide with at least `gap` between neighbours and
 * `padding` above and below the lot. n dots take n * dotSize + (n - 1) * gap.
 */
export function dotCapacity({
  height,
  dotSize,
  gap,
  padding,
}: {
  height: number;
  dotSize: number;
  gap: number;
  padding: number;
}): number {
  const inner = height - 2 * padding;
  return Math.max(0, Math.floor((inner + gap) / (dotSize + gap)));
}

/**
 * Whether the dots (one per page) still fit. An unmeasured bar (`height` null) keeps the dots: the
 * scrubber only takes over once there is proof they do not fit.
 */
export function fitsAsDots({
  totalPages,
  height,
  dotSize,
  gap,
  padding,
}: {
  totalPages: number;
  height: number | null;
  dotSize: number;
  gap: number;
  padding: number;
}): boolean {
  if (height == null) {return true;}
  return totalPages <= dotCapacity({ height, dotSize, gap, padding });
}

/** The page under a touch `offset` px down a track `trackHeight` tall (clamped to the track). */
export function pageAtOffset({
  offset,
  trackHeight,
  totalPages,
}: {
  offset: number;
  trackHeight: number;
  totalPages: number;
}): number {
  if (totalPages <= 1 || trackHeight <= 0) {return 0;}
  const fraction = Math.min(1, Math.max(0, offset / trackHeight));
  return Math.round(fraction * (totalPages - 1));
}

/** 0..1 — how far down the track a page sits (the first page is 0, the last is 1). */
export function fractionOfPage({ page, totalPages }: { page: number; totalPages: number }): number {
  if (totalPages <= 1) {return 0;}
  return Math.min(1, Math.max(0, page / (totalPages - 1)));
}
