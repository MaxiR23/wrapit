// tests/app/boards/boardDetail.test.tsx
//
// Tests for the board detail page ownership gates.
//
// Tested:
// - Renders the board title for the owner
// - Calls notFound when the board belongs to someone else
// - Calls notFound when the board id is unknown
//
// What is covered:
// - Owner happy path, non-owner and missing board as 404
//
// Run with: pnpm test:run tests/app/boards/boardDetail.test.tsx
//
// SEE: src/app/boards/[boardId]/page.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const getSession = vi.fn();
const getBoardForUser = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}));

vi.mock('@/lib/boards', () => ({
  getBoardForUser,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect,
  notFound,
}));

vi.mock('@/components/boards/NewColumnDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/boards/ColumnList', () => ({
  default: () => null,
}));

vi.mock('@/components/boards/ColumnsEmptyState', () => ({
  default: () => <p>This board has no columns yet. Create one to get started.</p>,
}));

const { default: BoardDetailPage } = await import('@/app/boards/[boardId]/page');

describe('Board detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { id: 'user-ada' } });
  });

  it('renders the board title for the owner', async () => {
    getBoardForUser.mockResolvedValue({
      id: 'board-1',
      title: 'Sprint board',
      ownerId: 'user-ada',
      columns: [],
    });

    const page = await BoardDetailPage({ params: Promise.resolve({ boardId: 'board-1' }) });
    render(page);

    expect(screen.getByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(getBoardForUser).toHaveBeenCalledWith('board-1', 'user-ada');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound when the board belongs to someone else', async () => {
    getBoardForUser.mockResolvedValue(null);

    await expect(
      BoardDetailPage({ params: Promise.resolve({ boardId: 'board-1' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when the board id is unknown', async () => {
    getBoardForUser.mockResolvedValue(null);

    await expect(
      BoardDetailPage({ params: Promise.resolve({ boardId: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
