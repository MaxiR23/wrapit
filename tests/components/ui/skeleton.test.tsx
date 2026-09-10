// tests/components/ui/skeleton.test.tsx
//
// Tests for the shared skeleton primitive.
//
// Tested:
// - Renders with the muted token and pulse
// - RouteSkeleton exposes a status region and delayed-reveal class
// - RouteSkeleton joins the fill-pane height chain
// - The source does not use a loose hex colour
//
// What is covered:
// - Class contract. jsdom cannot prove the delayed reveal hides a fast
//   response, that prefers-reduced-motion skips the animation, or that
//   flex actually fills a parent pane.
//
// Run with: pnpm test:run tests/components/ui/skeleton.test.tsx
//
// SEE: src/components/ui/skeleton.tsx

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RouteSkeleton, Skeleton } from '@/components/ui/skeleton';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/components/ui/skeleton.tsx'),
  'utf8',
);

describe('Skeleton', () => {
  it('uses the muted token and pulse', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse', 'bg-muted', 'rounded-md');
  });

  it('does not use a loose hex colour', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('RouteSkeleton', () => {
  it('exposes a busy status region and delayed-reveal class', () => {
    render(
      <RouteSkeleton>
        <Skeleton />
      </RouteSkeleton>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveClass('route-skeleton', 'flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
  });
});
