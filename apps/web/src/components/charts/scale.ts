/** Pure chart maths, kept separate from rendering so it can be unit-tested. */

/** A "nice" step (1, 2, 2.5 or 5 × 10^k) close to `rough`. */
export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const f = rough / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Clean axis ticks spanning [min, max] in roughly `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Compact tick text: 950, 1.5K, 12K, 1.2M. */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${+(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${+n.toFixed(1)}`;
}

/** Indices of x labels to draw so they don't collide (always includes the last one). */
export function labelIndices(count: number, plotWidth: number, labelWidth = 44): number[] {
  if (count === 0) return [];
  const fit = Math.max(1, Math.floor(plotWidth / labelWidth));
  const every = Math.max(1, Math.ceil(count / fit));
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= every) out.unshift(i);
  return out;
}

/** SVG path for a column with a 4px rounded data-end and a square baseline. */
export function columnPath(x: number, y: number, w: number, baseline: number, r = 4): string {
  const h = baseline - y;
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${baseline} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${baseline} Z`;
}
