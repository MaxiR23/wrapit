// tests/lib/labelTones.test.ts
//
// Tests for the eight label tone keys and class lookup.
//
// Tested:
// - The catalog has eight named tones in cycle order
// - parseLabelTone accepts catalog keys and rejects unknown values
// - labelToneClasses returns token classes, never a hex string
// - nextLabelTone walks the catalog and wraps from gray to blue
// - labelToneForIndex maps a count onto the catalog
//
// What is covered:
// - Catalog, parse, class map, cycle helpers
//
// Run with: pnpm test:run tests/lib/labelTones.test.ts
//
// SEE: src/lib/labelTones.ts

import { describe, it, expect } from 'vitest';

import {
  LABEL_TONES,
  labelToneClasses,
  labelToneForIndex,
  nextLabelTone,
  parseLabelTone,
} from '@/lib/labelTones';

describe('label tones', () => {
  it('lists eight tones in swatch cycle order', () => {
    expect(LABEL_TONES).toEqual([
      'blue',
      'green',
      'amber',
      'red',
      'violet',
      'cyan',
      'pink',
      'gray',
    ]);
  });

  it('parses catalog keys and returns null for unknown values', () => {
    expect(parseLabelTone('blue')).toBe('blue');
    expect(parseLabelTone('pink')).toBe('pink');
    expect(parseLabelTone('unknown')).toBeNull();
    expect(parseLabelTone(null)).toBeNull();
  });

  it('returns token classes without a hex color', () => {
    const classes = labelToneClasses('blue');
    expect(classes.pill).toContain('text-label-blue');
    expect(classes.swatch).toContain('bg-label-blue');
    expect(classes.pill).not.toMatch(/#|oklch\(/);
    expect(classes.swatch).not.toMatch(/#|oklch\(/);
  });

  it('walks the eight tones and wraps from gray to blue', () => {
    expect(nextLabelTone('blue')).toBe('green');
    expect(nextLabelTone('pink')).toBe('gray');
    expect(nextLabelTone('gray')).toBe('blue');
  });

  it('maps an index onto the catalog, including the seventh label', () => {
    expect(labelToneForIndex(0)).toBe('blue');
    expect(labelToneForIndex(6)).toBe('pink');
    expect(labelToneForIndex(7)).toBe('gray');
    expect(labelToneForIndex(8)).toBe('blue');
  });
});
