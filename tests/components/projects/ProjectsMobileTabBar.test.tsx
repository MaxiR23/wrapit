// tests/components/projects/ProjectsMobileTabBar.test.tsx
//
// Tests for the phone tab bar destinations, current-page marking, and pin.
//
// Tested:
// - Account links to /account
// - Account is current when activeNav is account
// - Projects, My tasks, and Archived stay wired to their routes
// - The bar composes safe-inset-x and safe-inset-b below tablet
//
// What is covered:
// - Account href, aria-current, other destinations, viewport pin classes
//
// Run with: pnpm test:run tests/components/projects/ProjectsMobileTabBar.test.tsx
//
// SEE: src/components/projects/ProjectsMobileTabBar.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProjectsMobileTabBar from '@/components/projects/ProjectsMobileTabBar';

describe('ProjectsMobileTabBar', () => {
  it('links Account to /account and marks it current when active', () => {
    render(<ProjectsMobileTabBar activeNav="account" />);

    const account = screen.getByRole('link', { name: 'Account' });
    expect(account).toHaveAttribute('href', '/account');
    expect(account).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current');
  });

  it('wires Projects, My tasks, and Archived to their routes', () => {
    render(<ProjectsMobileTabBar />);

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'My tasks' })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: 'Archived' })).toHaveAttribute('href', '/archived');
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: 'Account' })).not.toHaveAttribute('aria-current');
  });

  it('composes safe-inset-x and safe-inset-b below tablet', () => {
    render(<ProjectsMobileTabBar />);

    const bar = screen.getByRole('navigation', { name: 'Main' });

    expect(bar).toHaveClass('fixed', 'safe-inset-x', 'safe-inset-b', 'z-30', 'tablet:hidden');
    expect(bar.className).not.toMatch(/safe-area-inset/);
  });
});
