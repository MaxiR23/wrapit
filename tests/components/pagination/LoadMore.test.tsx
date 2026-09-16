// tests/components/pagination/LoadMore.test.tsx
//
// Tests for the shared Load more control.
//
// Tested:
// - Renders nothing when hasMore is false
// - Clicking calls back with the nextCursor received from the server
// - A second click while the first load is pending does not reuse the cursor
//
// What is covered:
// - Visibility from hasMore, opaque cursor echo, in-flight disable
//
// Run with: pnpm test:run tests/components/pagination/LoadMore.test.tsx
//
// SEE: src/components/pagination/LoadMore.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LoadMore from '@/components/pagination/LoadMore';

describe('LoadMore', () => {
  it('renders nothing when hasMore is false', () => {
    render(
      <LoadMore
        hasMore={false}
        nextCursor="opaque-cursor"
        onLoadMore={() => {}}
        label="Load more"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('calls back with the nextCursor received from the server', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <LoadMore hasMore nextCursor="opaque-cursor" onLoadMore={onLoadMore} label="Load more" />,
    );

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore).toHaveBeenCalledWith('opaque-cursor');
  });

  it('does not reuse the cursor while a load is pending', async () => {
    let finish: () => void = () => {};
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <LoadMore hasMore nextCursor="opaque-cursor" onLoadMore={onLoadMore} label="Load more" />,
    );

    const button = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore).toHaveBeenCalledWith('opaque-cursor');
    expect(button).toBeDisabled();
    finish();
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });
});
