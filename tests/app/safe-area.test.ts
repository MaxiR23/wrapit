// tests/app/safe-area.test.ts
//
// Tests for the global safe-area canvas and portaled-chrome CSS.
//
// Tested:
// - Body padding consumes all four safe-area insets
// - #safe-fixed-root is the safe rect; scrims expand with data-safe-scrim
// - dialog-phone-cover fills that root; the range is the caller's
// - safe-inset-* utilities set edges to env()
// - No class-substring matchers remain
//
// What is covered:
// - The CSS contract exists. jsdom cannot compute env() pixel values or
//   prove layout on a notched device; those require a real viewport-fit
//   cover client.
//
// Run with: pnpm test:run tests/app/safe-area.test.ts
//
// SEE: src/app/globals.css, src/components/ui/dialog.tsx

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/app/globals.css'),
  'utf8',
);

const dialogSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/components/ui/dialog.tsx'),
  'utf8',
);

describe('safe-area canvas', () => {
  it('pads the body on all four edges with the device insets', () => {
    expect(css).toMatch(/padding-top:\s*env\(safe-area-inset-top,\s*0px\)/);
    expect(css).toMatch(/padding-right:\s*env\(safe-area-inset-right,\s*0px\)/);
    expect(css).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
    expect(css).toMatch(/padding-left:\s*env\(safe-area-inset-left,\s*0px\)/);
  });

  it('does not match fixed chrome by class-name substring', () => {
    expect(css).not.toMatch(/\.fixed\[class\*=/);
  });

  it('pins the safe-fixed root to the four insets so fixed descendants use that box', () => {
    const root = css.match(/\.safe-fixed-root \{([\s\S]*?)\}/);

    expect(root?.[1]).toMatch(/position:\s*fixed/);
    expect(root?.[1]).toMatch(/transform:\s*translate\(0\)/);
    expect(root?.[1]).toMatch(/top:\s*env\(safe-area-inset-top,\s*0px\)/);
    expect(root?.[1]).toMatch(/right:\s*env\(safe-area-inset-right,\s*0px\)/);
    expect(root?.[1]).toMatch(/bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
    expect(root?.[1]).toMatch(/left:\s*env\(safe-area-inset-left,\s*0px\)/);
  });

  it('expands marked scrims from the root back to the physical viewport', () => {
    const scrim = css.match(/\.safe-fixed-root \[data-safe-scrim\] \{([\s\S]*?)\}/);

    expect(scrim?.[1]).toMatch(/top:\s*calc\(-1 \* env\(safe-area-inset-top,\s*0px\)\)/);
    expect(scrim?.[1]).toMatch(/right:\s*calc\(-1 \* env\(safe-area-inset-right,\s*0px\)\)/);
    expect(scrim?.[1]).toMatch(/bottom:\s*calc\(-1 \* env\(safe-area-inset-bottom,\s*0px\)\)/);
    expect(scrim?.[1]).toMatch(/left:\s*calc\(-1 \* env\(safe-area-inset-left,\s*0px\)\)/);
  });

  it('sizes cover dialogs to fill the portal root with no hardcoded range', () => {
    const cover = css.match(/@utility dialog-phone-cover \{([\s\S]*?)\}/);

    expect(cover?.[1]).toMatch(/inset:\s*0/);
    expect(cover?.[1]).toMatch(/height:\s*auto/);
    expect(cover?.[1]).not.toMatch(/env\(/);
    expect(cover?.[1]).not.toMatch(/margin-top:/);
    expect(cover?.[1]).not.toMatch(/@media/);
    expect(css).not.toMatch(
      /@media \(width < theme\(--breakpoint-tablet\)\) \{[\s\S]*?\.dialog-phone-cover/,
    );
  });

  it('defines edge utilities that set inset to env()', () => {
    expect(css).toMatch(/@utility safe-inset-t \{\s*top:\s*env\(safe-area-inset-top,\s*0px\);/);
    expect(css).toMatch(/@utility safe-inset-r \{\s*right:\s*env\(safe-area-inset-right,\s*0px\);/);
    expect(css).toMatch(
      /@utility safe-inset-b \{\s*bottom:\s*env\(safe-area-inset-bottom,\s*0px\);/,
    );
    expect(css).toMatch(/@utility safe-inset-l \{\s*left:\s*env\(safe-area-inset-left,\s*0px\);/);
  });

  it('lets DialogContent take the cover range from a complete max-* class', () => {
    expect(dialogSource).toMatch(/tablet:\s*'max-tablet:dialog-phone-cover'/);
    expect(dialogSource).toMatch(/md:\s*'max-md:dialog-phone-cover'/);
    expect(dialogSource).not.toMatch(/max-\[\$\{/);
  });

  it('centers DialogContent inside the portal root and marks the overlay as a scrim', () => {
    expect(dialogSource).toMatch(/getSafeFixedRoot\(\)/);
    expect(dialogSource).toMatch(/data-safe-scrim/);
    expect(dialogSource).toMatch(
      /layout === 'center' && 'top-1\/2 left-1\/2 max-h-full -translate-x-1\/2 -translate-y-1\/2'/,
    );
  });
});
