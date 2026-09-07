// tests/components/projects/shell.test.ts
//
// Tests for shared shell panel class names.
//
// Tested:
// - The phone sheet composes all four safe-inset utilities
// - The popover stays absolutely positioned, not fixed
//
// What is covered:
// - Sheet and popover class names
//
// Run with: pnpm test:run tests/components/projects/shell.test.ts
//
// SEE: src/components/projects/shell.ts

import { describe, it, expect } from 'vitest';

import { shellPanelClassName } from '@/components/projects/shell';

describe('shellPanelClassName', () => {
  it('composes all four safe-inset utilities on the phone sheet', () => {
    const className = shellPanelClassName('sheet');

    expect(className).toMatch(/\bfixed\b/);
    expect(className).toMatch(/\bsafe-inset-t\b/);
    expect(className).toMatch(/\bsafe-inset-r\b/);
    expect(className).toMatch(/\bsafe-inset-b\b/);
    expect(className).toMatch(/\bsafe-inset-l\b/);
    expect(className).not.toMatch(/\binset-0\b/);
    expect(className).not.toMatch(/safe-area-inset/);
  });

  it('keeps the desktop popover absolutely positioned', () => {
    const className = shellPanelClassName('popover');

    expect(className).toMatch(/\babsolute\b/);
    expect(className).not.toMatch(/\bfixed\b/);
    expect(className).not.toMatch(/safe-inset/);
  });
});
