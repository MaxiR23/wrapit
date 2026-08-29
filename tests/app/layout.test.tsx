// tests/app/layout.test.tsx
//
// Tests for the root layout html element.
//
// Tested:
// - Marks html so Next.js keeps CSS smooth scroll for in-page anchors only
//
// What is covered:
// - data-scroll-behavior opt-in
//
// Run with: pnpm test:run tests/app/layout.test.tsx
//
// SEE: src/app/layout.tsx

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/font/google', () => ({
  Geist: () => ({ className: 'font-sans', variable: '--font-sans' }),
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('opts Next.js into instant route-change scroll while CSS smooth stays for in-page anchors', () => {
    const markup = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <p>Page</p>
      </RootLayout>,
    );

    expect(markup).toContain('data-scroll-behavior="smooth"');
  });
});
