// tests/components/projects/ProjectStarButton.test.tsx
//
// Tests for the presentational project star button.
//
// Tested:
// - Renders Star / Unstar from the starred prop, with no internal state
// - Holds no useState, useRef, or other hooks of its own
// - Calls onToggle with the next starred value
// - Clicking the star does not activate a surrounding project link
//
// What is covered:
// - Controlled rendering, onToggle, no navigation, no local state/refs
//
// Run with: pnpm test:run tests/components/projects/ProjectStarButton.test.tsx
//
// SEE: src/components/projects/ProjectStarButton.tsx

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';

import ProjectStarButton from '@/components/projects/ProjectStarButton';

describe('ProjectStarButton', () => {
  it('renders from the starred prop and does not keep internal state', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ProjectStarButton projectId="project-1" starred={false} onToggle={onToggle} />,
    );

    expect(screen.getByRole('button', { name: 'Star project' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onToggle).toHaveBeenCalledWith('project-1', true);
    expect(screen.getByRole('button', { name: 'Star project' })).toBeInTheDocument();

    rerender(<ProjectStarButton projectId="project-1" starred={true} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Unstar project' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not navigate when the star is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <Link href="/projects/project-1">Sprint board</Link>
        <ProjectStarButton projectId="project-1" starred={false} onToggle={onToggle} />
      </div>,
    );

    const link = screen.getByRole('link');
    const onLinkClick = vi.fn();
    link.addEventListener('click', onLinkClick);

    await user.click(screen.getByRole('button', { name: 'Star project' }));

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith('project-1', true);
  });

  it('holds no state or refs', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../../../src/components/projects/ProjectStarButton.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/\buse(State|Ref|Optimistic|Reducer|Transition)\b/);
  });
});
