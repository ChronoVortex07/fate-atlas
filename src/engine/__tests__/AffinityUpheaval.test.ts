import { describe, it, expect } from 'vitest';
import { AXIS_AFFINITIES, axisOf } from '../../data/affinities';

describe('axis helpers', () => {
  it('AXIS_AFFINITIES maps each axis to its polar pair', () => {
    expect(AXIS_AFFINITIES.agency).toEqual(['fate', 'will']);
    expect(AXIS_AFFINITIES.information).toEqual(['light', 'shadow']);
    expect(AXIS_AFFINITIES.fortune).toEqual(['chaos', 'order']);
  });

  it('axisOf returns the axis each affinity belongs to', () => {
    expect(axisOf('fate')).toBe('agency');
    expect(axisOf('will')).toBe('agency');
    expect(axisOf('light')).toBe('information');
    expect(axisOf('shadow')).toBe('information');
    expect(axisOf('chaos')).toBe('fortune');
    expect(axisOf('order')).toBe('fortune');
  });
});
