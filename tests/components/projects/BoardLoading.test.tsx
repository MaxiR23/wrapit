// tests/components/projects/BoardLoading.test.tsx
//
// Tests for the board loading placeholder.
//
// Tested:
// - Renders desktop and mobile board landmarks
// - Does not render sidebar or tab bar chrome
// - Joins the fill-pane height chain so columns can flex instead of collapsing
//
// What is covered:
// - Shape landmarks and the flex height-chain classes. jsdom cannot prove
//   Next swaps this file in as the route loading fallback, that flex
//   actually fills the pane, or that nothing shifts when the page arrives.
//
// Run with: pnpm test:run tests/components/projects/BoardLoading.test.tsx
//
// SEE: src/components/projects/BoardLoading.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardLoading from '@/components/projects/BoardLoading';
import Loading from '@/app/(app)/projects/[projectId]/loading';

describe('BoardLoading', () => {
  it('renders desktop columns and a mobile column inside a status region', () => {
    const { container } = render(<BoardLoading />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(container.querySelector('[data-board="desktop"]')).toHaveClass('min-h-0', 'flex-1');
    expect(container.querySelector('[data-board="desktop"]')?.children).toHaveLength(3);
    expect(container.querySelector('[data-board="mobile"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('fills the pane rather than collapsing around column bones', () => {
    const { container } = render(
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <BoardLoading />
      </div>,
    );

    const pane = container.firstChild as HTMLElement;
    const status = screen.getByRole('status');
    const screenRoot = status.querySelector(':scope > div');

    expect(pane).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden');
    expect(status).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(screenRoot).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
  });

  it('is what the board loading route file renders', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('[data-board="desktop"]')).not.toBeNull();
  });
});
