// tests/components/tasks/MyTasksLoading.test.tsx
//
// Tests for the my-tasks loading placeholder.
//
// Tested:
// - Renders a busy status region with row bones
// - Does not render sidebar or tab bar chrome
//
// What is covered:
// - Shape landmarks. jsdom cannot prove Next swaps this file in as the
//   route loading fallback.
//
// Run with: pnpm test:run tests/components/tasks/MyTasksLoading.test.tsx
//
// SEE: src/components/tasks/MyTasksLoading.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import MyTasksLoading from '@/components/tasks/MyTasksLoading';
import Loading from '@/app/(app)/tasks/loading';

describe('MyTasksLoading', () => {
  it('renders row bones inside a status region and omits shell chrome', () => {
    const { container } = render(<MyTasksLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.rounded-\\[10px\\]').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('is what the tasks loading route file renders', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
