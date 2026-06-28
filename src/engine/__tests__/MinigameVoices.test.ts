import { describe, it, expect } from 'vitest';
import { READING_FRAGMENTS } from '../../data/reading-fragments';

describe('drawFraming fragments', () => {
  it('exposes variant scaffolds and group framing', () => {
    const df = READING_FRAGMENTS.drawFraming;
    expect(df.variantScaffolds.d20.length).toBeGreaterThan(0);
    expect(df.variantScaffolds.d20[0]).toContain('{n}');
    expect(df.group.lead.d20).toBeTruthy();
    expect(df.group.lead.generic).toBeTruthy();
    expect(typeof df.group.seqLast).toBe('string');
    expect(typeof df.group.listLast).toBe('string');
    expect(typeof df.group.mid).toBe('string');
  });
});
