// tests/components/projects/ProjectsSidebar.test.tsx
//
// Tests for the projects sidebar active nav item.
//
// Tested:
// - Marks Projects as the current page by default
// - Leaves no nav item current when activeNav is null
//
// What is covered:
// - Default active item, account screen with no active item
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

  it('leaves no nav item current when activeNav is null', () => {
    render(<ProjectsSidebar activeNav={null} />);

    const links = screen.getAllByRole('link', { name: 'Projects' });
    for (const link of links) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});
