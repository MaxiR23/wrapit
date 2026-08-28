// tests/components/projects/ProjectsSidebar.test.tsx
//
// Tests for the projects sidebar active nav item.
//
// Tested:
// - Marks Projects as the current page by default
// - Marks My tasks as the current page when activeNav is tasks
// - Leaves no nav item current when activeNav is null or account
// - Shows the open-task count on My tasks even when another item is active
//
// What is covered:
// - Default active item, My tasks active, account screen with no active item, count
//
// Run with: pnpm test:run tests/components/projects/ProjectsSidebar.test.tsx
//
// SEE: src/components/projects/ProjectsSidebar.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProjectsSidebar from '@/components/projects/ProjectsSidebar';

describe('ProjectsSidebar', () => {
  it('marks Projects as the current page by default', () => {
    render(<ProjectsSidebar />);

    const links = screen.getAllByRole('link', { name: 'Projects' });
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('marks My tasks as the current page when activeNav is tasks', () => {
    render(<ProjectsSidebar activeNav="tasks" openTaskCount={4} />);

    const links = screen.getAllByRole('link', { name: /My tasks/ });
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links.some((link) => link.textContent?.includes('4'))).toBe(true);
  });

  it('leaves no nav item current when activeNav is account', () => {
    render(<ProjectsSidebar activeNav="account" />);

    const links = screen.getAllByRole('link', { name: 'Projects' });
    for (const link of links) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('leaves no nav item current when activeNav is null', () => {
    render(<ProjectsSidebar activeNav={null} />);

    const links = screen.getAllByRole('link', { name: 'Projects' });
    for (const link of links) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('shows the open-task count on My tasks when Projects is active', () => {
    render(<ProjectsSidebar openTaskCount={2} />);

    const links = screen.getAllByRole('link', { name: /My tasks/ });
    expect(links.some((link) => link.textContent?.includes('2'))).toBe(true);
    for (const link of links) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('links Archived to /archived and marks it current when active', () => {
    render(<ProjectsSidebar activeNav="archived" />);

    const links = screen.getAllByRole('link', { name: 'Archived' });
    expect(links[0]).toHaveAttribute('href', '/archived');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });
});
