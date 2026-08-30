// tests/components/archived/ArchivedRow.test.tsx
//
// Tests for archived-task row gestures.
//
// Tested:
// - A long press selects and does not open detail
// - Moving more than 6px cancels the long press
// - A tap opens detail
// - A markdown title is not nested in a button
// - A title link does not open the row
//
// What is covered:
// - Long-press vs tap vs cancelled press, title-link isolation
//
// Run with: pnpm test:run tests/components/archived/ArchivedRow.test.tsx
//
// SEE: src/components/archived/ArchivedRow.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ArchivedRow from '@/components/archived/ArchivedRow';
import { ARCHIVED_LONG_PRESS_MS } from '@/lib/archived';
import type { ArchivedTask } from '@/lib/archived';

const card: ArchivedTask = {
  id: 'card-1',
  title: 'Write tests',
  code: 'SB-1',
  description: null,
  archivedAt: new Date('2026-08-20T10:00:00.000Z'),
  archivedBy: { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  column: { id: 'col-todo', title: 'To do' },
  label: { id: 'label-design', name: 'Design', tone: 'blue' },
  assignees: [],
  subtasks: [],
  comments: [],
};

function rowEl() {
  return screen.getByRole('article', { name: 'Write tests' });
}

describe('ArchivedRow', () => {
  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects on long press and does not open detail', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    const onLongPress = vi.fn();

    render(
      <ArchivedRow
        card={card}
        selected={false}
        selectionMode={false}
        swipeEnabled
        canAdminister
        dx={0}
        tween={false}
        onOpen={onOpen}
        onToggleSelect={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={onLongPress}
        onSwipeChange={vi.fn()}
        onSwipeEnd={vi.fn()}
      />,
    );

    fireEvent.pointerDown(rowEl(), { pointerId: 1, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(ARCHIVED_LONG_PRESS_MS);
    });
    fireEvent.click(rowEl());

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels the long press when the pointer moves more than 6px', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();

    render(
      <ArchivedRow
        card={card}
        selected={false}
        selectionMode={false}
        swipeEnabled
        canAdminister
        dx={0}
        tween={false}
        onOpen={vi.fn()}
        onToggleSelect={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={onLongPress}
        onSwipeChange={vi.fn()}
        onSwipeEnd={vi.fn()}
      />,
    );

    fireEvent.pointerDown(rowEl(), { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent(window, new PointerEvent('pointermove', { pointerId: 1, clientX: 20, clientY: 10 }));
    act(() => {
      vi.advanceTimersByTime(ARCHIVED_LONG_PRESS_MS);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('opens detail on tap', () => {
    const onOpen = vi.fn();

    render(
      <ArchivedRow
        card={card}
        selected={false}
        selectionMode={false}
        swipeEnabled
        canAdminister
        dx={0}
        tween={false}
        onOpen={onOpen}
        onToggleSelect={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={vi.fn()}
        onSwipeChange={vi.fn()}
        onSwipeEnd={vi.fn()}
      />,
    );

    fireEvent.pointerDown(rowEl(), { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent(window, new PointerEvent('pointerup', { pointerId: 1, clientX: 10, clientY: 10 }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders markdown in an archived card title', () => {
    render(
      <ArchivedRow
        card={{ ...card, title: '**Write tests**' }}
        selected={false}
        selectionMode={false}
        swipeEnabled
        canAdminister
        dx={0}
        tween={false}
        onOpen={vi.fn()}
        onToggleSelect={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={vi.fn()}
        onSwipeChange={vi.fn()}
        onSwipeEnd={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Write tests')[0]!.closest('strong')).toHaveTextContent(
      'Write tests',
    );
    expect(screen.getAllByText('Write tests')[0]!.closest('button')).toBeNull();
  });

  it('opens the row from the article and does not open when a title link is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <ArchivedRow
        card={{ ...card, title: '[docs](https://example.com/x)' }}
        selected={false}
        selectionMode={false}
        swipeEnabled={false}
        canAdminister
        dx={0}
        tween={false}
        onOpen={onOpen}
        onToggleSelect={vi.fn()}
        onRestore={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onLongPress={vi.fn()}
        onSwipeChange={vi.fn()}
        onSwipeEnd={vi.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link.closest('button')).toBeNull();
    await user.click(link);
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(screen.getByText('0/0 subtasks · 0 comments'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
