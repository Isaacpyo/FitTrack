import { describe, expect, it } from 'vitest';
import {
  columnPath,
  compactNumber,
  labelIndices,
  niceStep,
  niceTicks,
} from '../src/components/charts/scale';

describe('chart scales', () => {
  it('picks nice steps', () => {
    expect([0.7, 1.4, 2.2, 3, 7, 23, 180].map(niceStep)).toEqual([1, 2, 2.5, 5, 10, 25, 200]);
  });

  it('builds clean ticks that cover the data', () => {
    expect(niceTicks(0, 9500, 3)).toEqual([0, 5000, 10000]);
    expect(niceTicks(72.4, 96.3, 3)).toEqual([70, 80, 90, 100]);
    expect(niceTicks(50, 50, 3).length).toBeGreaterThan(1); // flat series still gets an axis
  });

  it('formats compact numbers', () => {
    expect([950, 1500, 12_340, 2_500_000].map(compactNumber)).toEqual([
      '950',
      '1.5K',
      '12K',
      '2.5M',
    ]);
  });

  it('thins x labels so they never collide, always keeping the latest', () => {
    expect(labelIndices(14, 300, 44)).toEqual([1, 4, 7, 10, 13]); // 300px fits 6 labels
    expect(labelIndices(5, 1000, 44)).toEqual([0, 1, 2, 3, 4]);
    expect(labelIndices(0, 300)).toEqual([]);
  });

  it('draws columns with a rounded data-end and nothing for zero values', () => {
    expect(columnPath(10, 20, 24, 100)).toBe('M10,100 V24 Q10,20 14,20 H30 Q34,20 34,24 V100 Z');
    expect(columnPath(10, 100, 24, 100)).toBe('');
  });
});
