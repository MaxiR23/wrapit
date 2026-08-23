// tests/lib/labelTones.test.ts
//
// Tests for the eight label tone keys and class lookup.
//
// Tested:
// - The catalog has eight named tones in cycle order
// - parseLabelTone accepts catalog keys and rejects unknown values
// - labelToneClasses returns token classes, never a hex string
//
// What is covered:
// - Catalog, parse, class map
//
// Run with: pnpm test:run tests/lib/labelTones.test.ts
//
// SEE: src/lib/labelTones.ts

import { describe, it, expect } from 'vitest';

import { LABEL_TONES, labelToneClasses, parseLabelTone } from '@/lib/labelTones';

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
    expect(classes.pill).not.toMatch(/#|oklch\(/);
  });
});
