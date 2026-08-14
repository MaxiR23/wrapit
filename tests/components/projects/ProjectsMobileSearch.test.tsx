// tests/components/projects/ProjectsMobileSearch.test.tsx
//
// Tests for the mobile search row new-project trigger.
//
// Tested:
// - Opens the existing new-project dialog from the mobile + button
//
// What is covered:
// - Create-project trigger
//
// Run with: pnpm test:run tests/components/projects/ProjectsMobileSearch.test.tsx
//
// SEE: src/components/projects/ProjectsMobileSearch.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/actions/createProject', () => ({
  createProject: vi.fn(),
}));

const { default: ProjectsMobileSearch } =
  await import('@/components/projects/ProjectsMobileSearch');
const { ProjectsSearchProvider } = await import('@/components/projects/ProjectsSearch');

describe('ProjectsMobileSearch', () => {
  it('opens the new project dialog from the mobile + button', async () => {
    const user = userEvent.setup();
    render(
      <ProjectsSearchProvider>
        <ProjectsMobileSearch />
      </ProjectsSearchProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'New project' }));

    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });
});
