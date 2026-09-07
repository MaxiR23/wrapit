// tests/app/layout.test.tsx
//
// Tests for the root layout html element and viewport export.
//
// Tested:
// - Marks html so Next.js keeps CSS smooth scroll for in-page anchors only
// - Covers the device safe area so env(safe-area-inset-*) is available
// - Body fills the html box so h-full children sit on the padded canvas
// - Mounts the safe-fixed root so portaled chrome is the safe rect
//
// What is covered:
// - data-scroll-behavior opt-in, viewport-fit cover, body height, safe-fixed root
//
// Run with: pnpm test:run tests/app/layout.test.tsx
//
// SEE: src/app/layout.tsx

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/font/google', () => ({
  Geist: () => ({ className: 'font-sans', variable: '--font-sans' }),
}));

import RootLayout, { viewport } from '@/app/layout';

describe('RootLayout', () => {
  it('opts Next.js into instant route-change scroll while CSS smooth stays for in-page anchors', () => {
    const markup = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <p>Page</p>
      </RootLayout>,
    );

    expect(markup).toContain('data-scroll-behavior="smooth"');
    expect(markup).toContain('flex h-full min-h-full flex-col');
    expect(markup).toContain('id="safe-fixed-root"');
    expect(markup).toContain('safe-fixed-root');
  });

  it('covers the device safe area so env(safe-area-inset-*) is available', () => {
    expect(viewport).toEqual({ viewportFit: 'cover' });
  });
});
