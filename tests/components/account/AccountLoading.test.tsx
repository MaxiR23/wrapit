// tests/components/account/AccountLoading.test.tsx
//
// Tests for the account loading placeholder.
//
// Tested:
// - Renders a busy status region with a pinned header and section bones
// - Does not render sidebar or tab bar chrome
//
// What is covered:
// - Shape landmarks. jsdom cannot prove Next swaps this file in as the
//   route loading fallback.
//
// Run with: pnpm test:run tests/components/account/AccountLoading.test.tsx
//
// SEE: src/components/account/AccountLoading.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import AccountLoading from '@/components/account/AccountLoading';
import Loading from '@/app/(app)/account/loading';

describe('AccountLoading', () => {
  it('renders a pinned header and section bones inside a status region', () => {
    const { container } = render(<AccountLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('header.projects-content-wash')).not.toBeNull();
    expect(container.querySelectorAll('.rounded-lg.border.bg-surface').length).toBe(2);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('is what the account loading route file renders', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('header.projects-content-wash')).not.toBeNull();
  });
});
