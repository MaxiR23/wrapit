// tests/app/route-skeleton.test.ts
//
// Tests for the delayed-reveal CSS on route loading fallbacks.
//
// Tested:
// - .route-skeleton delays opacity until 200ms
// - prefers-reduced-motion skips the delay and the pulse
//
// What is covered:
// - The CSS contract exists. jsdom cannot prove a fast RSC response avoids a
//   visible flicker.
//
// Run with: pnpm test:run tests/app/route-skeleton.test.ts
//
// SEE: src/app/globals.css

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/app/globals.css'),
  'utf8',
);

describe('route skeleton reveal', () => {
  it('delays opacity until 200ms then fades in', () => {
    expect(css).toMatch(/@keyframes route-skeleton-in/);
    expect(css).toMatch(
      /\.route-skeleton \{\s*animation:\s*route-skeleton-in 150ms ease 200ms both;/,
    );
  });

  it('skips the delay and pulse when motion is reduced', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\) \{[\s\S]*\.route-skeleton \{[\s\S]*animation:\s*none;/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\) \{[\s\S]*\.route-skeleton \[data-slot='skeleton'\] \{[\s\S]*animation:\s*none;/,
    );
  });
});
