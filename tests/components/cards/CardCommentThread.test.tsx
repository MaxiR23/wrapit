// tests/components/cards/CardCommentThread.test.tsx
//
// Tests for comment markdown display and the composer toolbar.
//
// Tested:
// - A posted comment renders markdown
// - The composer toolbar inserts markers into the draft
// - Submit sends the markdown source
//
// What is covered:
// - Rendered body, toolbar insert, stored-as-typed create
//
// Run with: pnpm test:run tests/components/cards/CardCommentThread.test.tsx
//
// SEE: src/components/cards/CardCommentThread.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BoardComment, BoardMember } from '@/components/projects/boardTypes';

const createComment = vi.fn();

vi.mock('@/actions/createComment', () => ({ createComment }));

const { default: CardCommentThread, CardCommentComposer } =
  await import('@/components/cards/CardCommentThread');

const ada: BoardMember = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };

const comment: BoardComment = {
  id: 'c1',
  body: 'Looks **good**',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  author: ada,
};

describe('CardCommentThread', () => {
  it('renders markdown in a posted comment', () => {
    const { container } = render(<CardCommentThread comments={[comment]} />);

    expect(container.querySelector('strong')).toHaveTextContent('good');
  });
});

describe('CardCommentComposer', () => {
  beforeEach(() => {
    createComment.mockReset();
    createComment.mockResolvedValue({
      data: {
        id: 'c2',
        body: '**hi**',
        createdAt: new Date(),
        cardId: 'card-1',
        author: ada,
      },
    });
  });

  it('inserts bold markers from the toolbar', async () => {
    const user = userEvent.setup();
    render(
      <CardCommentComposer cardId="card-1" comments={[]} currentUser={ada} onChange={vi.fn()} />,
    );

    const field = screen.getByRole('textbox', { name: 'Write a comment' }) as HTMLTextAreaElement;
    await user.type(field, 'hi');
    field.setSelectionRange(0, 2);
    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(field).toHaveValue('**hi**');
  });

  it('submits the markdown source unchanged', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CardCommentComposer cardId="card-1" comments={[]} currentUser={ada} onChange={onChange} />,
    );

    const field = screen.getByRole('textbox', { name: 'Write a comment' });
    await user.type(field, '**hi**');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({ cardId: 'card-1', body: '**hi**' });
    });
  });
});
