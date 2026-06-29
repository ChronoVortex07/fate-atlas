import { describe, it, expect } from 'vitest';
import { fitList } from '../../components/share/fitList';

// Pure shrink/cap arithmetic behind the ShareCard auto-fit. Heights are in px;
// the component measures them and feeds them in.
describe('fitList', () => {
  it('shows everything at full scale when the rows already fit', () => {
    const r = fitList({ available: 300, contentHeight: 210, rowStride: 30, totalRows: 7 });
    expect(r).toEqual({ scale: 1, visibleRows: 7, hiddenRows: 0 });
  });

  it('treats an exact fit as full scale, nothing hidden', () => {
    const r = fitList({ available: 210, contentHeight: 210, rowStride: 30, totalRows: 7 });
    expect(r).toEqual({ scale: 1, visibleRows: 7, hiddenRows: 0 });
  });

  it('gently shrinks to fit all rows when the squeeze stays above the floor', () => {
    const r = fitList({ available: 180, contentHeight: 210, rowStride: 30, totalRows: 7, minScale: 0.72 });
    expect(r.scale).toBeCloseTo(180 / 210, 5);
    expect(r.visibleRows).toBe(7);
    expect(r.hiddenRows).toBe(0);
  });

  it('clamps to the floor and caps rows (reserving a "+N more" slot) when it cannot fit them all', () => {
    const r = fitList({ available: 120, contentHeight: 300, rowStride: 30, totalRows: 10, minScale: 0.72, moreStride: 30 });
    // usable = 120 / 0.72 = 166.7; (166.7 - 30) / 30 = 4.55 -> 4 rows fit, 6 spill into "+N more".
    expect(r.scale).toBe(0.72);
    expect(r.visibleRows).toBe(4);
    expect(r.hiddenRows).toBe(6);
  });

  it('always shows at least one row even when space is tiny', () => {
    const r = fitList({ available: 20, contentHeight: 300, rowStride: 30, totalRows: 10, minScale: 0.72, moreStride: 30 });
    expect(r.visibleRows).toBe(1);
    expect(r.hiddenRows).toBe(9);
  });

  it('caps so that some rows are always hidden in the cap branch (visible < total)', () => {
    const r = fitList({ available: 100, contentHeight: 300, rowStride: 30, totalRows: 10, minScale: 0.72 });
    expect(r.visibleRows).toBeLessThan(10);
    expect(r.visibleRows + r.hiddenRows).toBe(10);
  });

  it('handles an empty reading', () => {
    const r = fitList({ available: 300, contentHeight: 0, rowStride: 30, totalRows: 0 });
    expect(r).toEqual({ scale: 1, visibleRows: 0, hiddenRows: 0 });
  });

  it('defaults moreStride to rowStride when omitted', () => {
    const withDefault = fitList({ available: 120, contentHeight: 300, rowStride: 30, totalRows: 10, minScale: 0.72 });
    const explicit = fitList({ available: 120, contentHeight: 300, rowStride: 30, totalRows: 10, minScale: 0.72, moreStride: 30 });
    expect(withDefault).toEqual(explicit);
  });
});
