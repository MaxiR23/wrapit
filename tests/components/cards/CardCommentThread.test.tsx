// tests/components/cards/CardCommentThread.test.tsx
//
// Tests for comment markdown display, the composer toolbar, and author edit.
//
// Tested:
// - A posted comment renders markdown
// - A fresh comment does not show (edited)
// - An edited comment shows (edited) with the edit time in a title
// - The edit control appears only on the current user's comments
// - Cancel does not call updateComment
// - Save sends the markdown source
// - Blur does not call updateComment
// - Occupancy conflict keeps the typed draft
//
// What is covered:
// - Rendered body, author-only edit, save/cancel, no blur-save, conflict draft
//
// Run with: pnpm test:run tests/components/cards/CardCommentThread.test.tsx
//
// SEE: src/components/cards/CardCommentThread.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BoardComment, BoardMember } from '@/components/projects/boardTypes';
import { COMMENT_CHANGED_ELSEWHERE_MESSAGE } from '@/lib/messages';

const createComment = vi.fn();
const updateComment = vi.fn();

vi.mock('@/actions/createComment', () => ({ createComment }));
vi.mock('@/actions/updateComment', () => ({ updateComment }));

const { default: CardCommentThread, CardCommentComposer } =
  await import('@/components/cards/CardCommentThread');

const ada: BoardMember = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const grace: BoardMember = { id: 'user-grace', name: 'Grace Hopper', username: 'grace' };

const editedAt = new Date('2026-08-21T12:00:00.000Z');

const comment: BoardComment = {
  id: 'c1',
  body: 'Looks **good**',
  createdAt: new Date('2026-08-20T10:00:00.000Z'),
  editedAt: null,
  author: ada,
};

function renderThread(comments: BoardComment[], currentUser: BoardMember = ada, canComment = true) {
  const onChange = vi.fn();
  const view = render(
    <CardCommentThread
      comments={comments}
      currentUser={currentUser}
      canComment={canComment}
      onChange={onChange}
    />,
  );
  return { ...view, onChange };
}

describe('CardCommentThread', () => {
  beforeEach(() => {
    updateComment.mockReset();
  });

  it('renders markdown in a posted comment', () => {
    const { container } = renderThread([comment]);

    expect(container.querySelector('strong')).toHaveTextContent('good');
    expect(screen.queryByText('(edited)')).not.toBeInTheDocument();
  });

  it('shows (edited) next to the created timestamp, not as the visible date', () => {
    renderThread([{ ...comment, editedAt }]);

    expect(screen.getByText('(edited)')).toHaveAttribute('title', editedAt.toISOString());
    expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
    expect(screen.queryByText(editedAt.toISOString())).not.toBeInTheDocument();
  });

  it('shows the edit control only on the current user comment', () => {
    renderThread([comment, { ...comment, id: 'c2', author: grace, body: 'From grace' }], ada);

    expect(screen.getAllByRole('button', { name: 'Edit comment' })).toHaveLength(1);
  });

  it('does not show the edit control when the author cannot comment', () => {
    renderThread([comment], ada, false);

    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument();
  });

  it('does not call updateComment when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderThread([comment]);

    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const field = screen.getByRole('textbox', { name: 'Edit comment body' });
    await user.clear(field);
    await user.type(field, 'Changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateComment).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Edit comment body' })).not.toBeInTheDocument();
    expect(screen.getByText('good').tagName).toBe('STRONG');
  });

  it('does not call updateComment on blur', async () => {
    const user = userEvent.setup();
    renderThread([comment]);

    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const field = screen.getByRole('textbox', { name: 'Edit comment body' });
    await user.type(field, ' extra');
    await user.tab();

    expect(updateComment).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Edit comment body' })).toHaveValue(
      'Looks **good** extra',
    );
  });

  it('saves the markdown source and keeps the same rendering after edit', async () => {
    const user = userEvent.setup();
    updateComment.mockResolvedValue({
      data: {
        id: 'c1',
        body: 'Looks **good**',
        createdAt: comment.createdAt,
        editedAt,
        cardId: 'card-1',
        author: ada,
      },
    });
    const { container, onChange } = renderThread([comment]);
    expect(container.querySelector('strong')).toHaveTextContent('good');

    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith({
        commentId: 'c1',
        body: 'Looks **good**',
      });
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ body: 'Looks **good**', editedAt }),
    ]);
  });

  it('keeps the typed text and stays in edit after an occupancy conflict', async () => {
    const user = userEvent.setup();
    updateComment.mockResolvedValue({ error: COMMENT_CHANGED_ELSEWHERE_MESSAGE });
    renderThread([comment]);

    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const field = screen.getByRole('textbox', { name: 'Edit comment body' });
    await user.clear(field);
    await user.type(field, 'My later draft');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(COMMENT_CHANGED_ELSEWHERE_MESSAGE);
    });
    expect(screen.getByRole('textbox', { name: 'Edit comment body' })).toHaveValue(
      'My later draft',
    );
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
        editedAt: null,
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
