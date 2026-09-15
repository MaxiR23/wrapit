// tests/components/projects/ProjectsMobileTabBar.test.tsx
//
// Tests for the phone tab bar destinations, current-page marking, and pin.
//
// Tested:
// - Account links to /account
// - Account is current when activeNav is account
// - Projects, My tasks, and Archived stay wired to their routes
// - The bar is fixed with token inset padding, not a flush border-t
// - The inner surface uses --radius-2xl, not a flush border-t
// - In-tree pin composes safe-inset-x and safe-inset-b with the visual inset
// - Tab links use inset focus rings so overflow-hidden does not clip them
//
// What is covered:
// - Account href, aria-current, other destinations, floating chrome styles
//   and safe-inset utilities. jsdom cannot prove the home-indicator gap.
//
// Run with: pnpm test:run tests/components/projects/ProjectsMobileTabBar.test.tsx
//
// SEE: src/components/projects/ProjectsMobileTabBar.tsx, src/app/globals.css

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

  it('pins a floating pill inset from the edges, not a flush border-t', () => {
    render(<ProjectsMobileTabBar />);

    const bar = screen.getByRole('navigation', { name: 'Main' });
    const surface = bar.firstElementChild as HTMLElement;

    expect(bar).toHaveClass('fixed', 'z-30', 'tablet:hidden', 'safe-inset-x', 'safe-inset-b');
    expect(bar).not.toHaveClass('border-t');
    expect(bar).toHaveStyle({
      paddingLeft: 'var(--spacing-mobile-tab-bar-inset)',
      paddingRight: 'var(--spacing-mobile-tab-bar-inset)',
      paddingBottom: 'var(--spacing-mobile-tab-bar-inset)',
    });
    expect(bar.style.left).toBe('');
    expect(bar.style.right).toBe('');
    expect(bar.style.bottom).toBe('');
    expect(bar.style.width).toBe('');
    expect(surface).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      height: 'var(--spacing-mobile-tab-bar)',
      overflow: 'hidden',
      borderRadius: 'var(--radius-2xl)',
      backgroundColor: 'var(--mobile-tab-bar)',
      boxShadow: 'var(--shadow-mobile-tab-bar)',
    });
    expect(surface.className).not.toContain('backdrop-blur');
  });

  it('keeps keyboard focus rings inside the clipped surface', () => {
    render(<ProjectsMobileTabBar />);

    for (const name of ['Projects', 'My tasks', 'Archived', 'Account']) {
      const tab = screen.getByRole('link', { name });
      expect(tab).toHaveClass('focus-visible:-outline-offset-2');
      expect(tab.className.split(' ')).not.toContain('focus-visible:outline-offset-2');
    }
  });
});
