// tests/components/projects/ProjectListRow.test.tsx
//
// Tests for the projects list row star control and phone swipe.
//
// Tested:
// - Star button calls onToggle with the next starred value
// - Clicking the star does not activate the project link
// - A right swipe on a phone list row stars the project
// - A left swipe on a phone list row archives the project
// - A cancelled swipe past the commit threshold resets the row and commits nothing
//
// What is covered:
// - Presentational star toggle on the list row, phone swipe reuse
//
// Run with: pnpm test:run tests/components/projects/ProjectListRow.test.tsx
//
// SEE: src/components/projects/ProjectListRow.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProjectListRow from '@/components/projects/ProjectListRow';
import type { ProjectSummary } from '@/lib/projectGrid';
import { SWIPE_COMMIT_PX } from '@/lib/swipe';

const project: ProjectSummary = {
  id: 'project-1',
  title: 'Sprint board',
  status: 'IN_PROGRESS',
  statusLabel: 'In progress',
  taskCount: 24,
  doneCount: 11,
  percent: 46,
  updatedLabel: 'Updated 2 hours ago',
  starred: false,
  canAdminister: true,
  members: [{ id: 'user-ada', name: 'Ada Lovelace', username: 'ada' }],
};

describe('ProjectListRow', () => {
  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
  });
  it('calls onToggle with the next starred value', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectListRow project={project} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('does not navigate when the star is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProjectListRow project={project} onToggle={onToggle} />);

    const link = screen.getByRole('link', { name: /Sprint board/ });
    const onLinkClick = vi.fn();
    link.addEventListener('click', onLinkClick);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('stars the project when a phone list row is swiped right', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 599px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    const onToggle = vi.fn();
    render(<ProjectListRow project={project} onToggle={onToggle} />);

    const row = screen.getByRole('link', { name: /Sprint board/ }).parentElement;
    if (!row) throw new Error('Missing list row');
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent(
      window,
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 10 + SWIPE_COMMIT_PX + 8,
        clientY: 10,
      }),
    );
    fireEvent(window, new PointerEvent('pointerup', { pointerId: 1, clientX: 120, clientY: 10 }));

    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('archives the project when a phone list row is swiped left', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 599px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    const onArchive = vi.fn();
    render(<ProjectListRow project={project} onArchive={onArchive} />);

    const row = screen.getByRole('link', { name: /Sprint board/ }).parentElement;
    if (!row) throw new Error('Missing list row');
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 120, clientY: 10 });
    fireEvent(
      window,
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 120 - SWIPE_COMMIT_PX - 8,
        clientY: 10,
      }),
    );
    fireEvent(window, new PointerEvent('pointerup', { pointerId: 1, clientX: 10, clientY: 10 }));

    expect(onArchive).toHaveBeenCalledWith(project);
  });

  it('resets the row and commits nothing when a swipe past the threshold is cancelled', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 599px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    const onToggle = vi.fn();
    const onArchive = vi.fn();
    render(<ProjectListRow project={project} onToggle={onToggle} onArchive={onArchive} />);

    const row = screen.getByRole('link', { name: /Sprint board/ }).parentElement;
    if (!row) throw new Error('Missing list row');
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent(
      window,
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 10 + SWIPE_COMMIT_PX + 8,
        clientY: 10,
      }),
    );
    fireEvent(
      window,
      new PointerEvent('pointercancel', {
        pointerId: 1,
        clientX: 10 + SWIPE_COMMIT_PX + 8,
        clientY: 10,
      }),
    );

    expect(onToggle).not.toHaveBeenCalled();
    expect(onArchive).not.toHaveBeenCalled();
    expect(row).toHaveStyle({ transform: 'translateX(0px)' });
  });
});
