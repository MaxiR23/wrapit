// tests/app/projects/projectDetail.test.tsx
//
// Tests for the project detail page access gates.
//
// Tested:
// - Renders the project title for a member
// - Mounts the recents recorder after access is confirmed
// - Calls notFound when getProjectForUser returns null
// - Calls notFound when the project id is unknown
//
// What is covered:
// - Owner happy path, non-owner and missing project as 404
//
// Run with: pnpm test:run tests/app/projects/projectDetail.test.tsx
//
// SEE: src/app/projects/[projectId]/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getSession = vi.fn();
const getProjectForUser = vi.fn();
const recordRecentProject = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/projects', () => ({
  getProjectForUser,
}));

vi.mock('@/actions/recordRecentProject', () => ({
  recordRecentProject,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  notFound,
}));

vi.mock('@/components/projects/NewColumnDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/projects/ProjectKanban', () => ({
  default: () => null,
}));

vi.mock('@/components/projects/ColumnsEmptyState', () => ({
  default: () => <p>This project has no columns yet. Create one to get started.</p>,
}));

const { default: ProjectDetailPage } = await import('@/app/projects/[projectId]/page');

describe('Project detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { id: 'user-ada' } });
    recordRecentProject.mockResolvedValue(undefined);
  });

  it('renders the project title for a member', async () => {
    getProjectForUser.mockResolvedValue({
      id: 'project-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      columns: [],
    });

    const page = await ProjectDetailPage({ params: Promise.resolve({ projectId: 'project-1' }) });
    render(page);

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(getProjectForUser).toHaveBeenCalledWith('project-1', 'user-ada');
    expect(notFound).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(recordRecentProject).toHaveBeenCalledWith('project-1');
    });
  });

  it('calls notFound when the project belongs to someone else', async () => {
    getProjectForUser.mockResolvedValue(null);

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ projectId: 'project-1' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when the project id is unknown', async () => {
    getProjectForUser.mockResolvedValue(null);

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ projectId: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
