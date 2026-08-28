// tests/components/projects/ProjectsMobileTabBar.test.tsx
//
// Tests for the phone tab bar destinations and current-page marking.
//
// Tested:
// - Account links to /account
// - Account is current when activeNav is account
// - Projects, My tasks, and Archived stay wired to their routes
//
// What is covered:
// - Account href, aria-current, other destinations
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
});
