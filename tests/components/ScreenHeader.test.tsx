// tests/components/ScreenHeader.test.tsx
//
// Tests for the shared screen header identity, inset, and breadcrumb slot.
//
// Tested:
// - Renders a title inside the screen-header slot
// - Title-only and breadcrumb headers share the identity min-height classes
// - Places actions after the title
// - Flush inset adds no pane padding; pane inset uses the shared tokens and wash
// - Truncates the breadcrumb slot so a long crumb cannot grow the identity
// - Renders extra children below the identity
// - Actions occupy the full row below tablet so inner flex-1 controls can fill
// - globals.css defines the shared inset and identity tokens
//
// What is covered:
// - Slot contract, shared classes, inset variants, token presence. jsdom cannot
//   prove the title baseline in pixels across viewports.
//
// Run with: pnpm test:run tests/components/ScreenHeader.test.tsx
//
// SEE: src/components/ScreenHeader.tsx, src/app/globals.css

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ScreenHeader, {
  screenHeaderIdentityClassName,
  screenInsetClassName,
} from '@/components/ScreenHeader';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/app/globals.css'),
  'utf8',
);

describe('ScreenHeader', () => {
  it('defines shared inset and identity tokens in globals.css', () => {
    expect(css).toMatch(/--spacing-screen-x:/);
    expect(css).toMatch(/--spacing-screen-pt:/);
    expect(css).toMatch(/--spacing-screen-header:/);
    expect(css).toMatch(/--text-screen-title:/);
    expect(css).toMatch(/--tracking-screen-title:/);
  });
  it('renders a title inside the screen-header slot', () => {
    render(<ScreenHeader title="Projects" />);

    const heading = screen.getByRole('heading', { name: 'Projects' });
    expect(heading.closest('[data-slot="screen-header"]')).not.toBeNull();
  });

  it('uses the same identity min-height with or without a breadcrumb', () => {
    const titleOnly = render(<ScreenHeader title="Projects" />);
    const titleIdentity = titleOnly.container.querySelector('[data-slot="screen-header-identity"]');

    const withCrumb = render(
      <ScreenHeader breadcrumb={<>Projects / Archived</>} title="Archived" />,
    );
    const crumbIdentity = withCrumb.container.querySelector('[data-slot="screen-header-identity"]');

    expect(titleIdentity).toHaveClass(...screenHeaderIdentityClassName.split(' '));
    expect(crumbIdentity).toHaveClass(...screenHeaderIdentityClassName.split(' '));
    expect(titleIdentity?.className).toBe(crumbIdentity?.className);
  });

  it('places actions after the title', () => {
    render(<ScreenHeader title="Projects" actions={<button type="button">New project</button>} />);

    const heading = screen.getByRole('heading', { name: 'Projects' });
    const action = screen.getByRole('button', { name: 'New project' });
    expect(heading.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('makes the actions row full width below tablet', () => {
    render(<ScreenHeader title="My tasks" actions={<button type="button">New task</button>} />);

    const actions = screen
      .getByRole('button', { name: 'New task' })
      .closest('[data-slot="screen-header-actions"]');
    expect(actions).toHaveClass('w-full', 'tablet:w-auto', 'min-w-0');
  });

  it('keeps flush headers free of pane inset and wash', () => {
    const { container } = render(<ScreenHeader title="Projects" />);
    const header = container.querySelector('[data-slot="screen-header"]');

    expect(header).not.toHaveClass('projects-content-wash');
    for (const token of screenInsetClassName.split(' ')) {
      expect(header).not.toHaveClass(token);
    }
  });

  it('applies the shared inset tokens and wash on pane headers', () => {
    const { container } = render(<ScreenHeader title="Sprint board" inset="pane" />);
    const header = container.querySelector('[data-slot="screen-header"]');

    expect(header).toHaveClass('projects-content-wash', ...screenInsetClassName.split(' '));
  });

  it('truncates the breadcrumb slot', () => {
    render(
      <ScreenHeader
        breadcrumb="Projects / A very long project title / Archived"
        title="Archived"
      />,
    );

    const crumb = screen.getByRole('navigation');
    expect(crumb).toHaveClass('truncate');
    expect(crumb.parentElement).toHaveClass('h-screen-breadcrumb');
  });

  it('renders extra children below the identity', () => {
    render(
      <ScreenHeader title="Account">
        <div>Profile</div>
      </ScreenHeader>,
    );

    const identity = screen
      .getByRole('heading', { name: 'Account' })
      .closest('[data-slot="screen-header-identity"]');
    const extra = screen.getByText('Profile');
    expect(identity?.contains(extra)).toBe(false);
    expect(
      identity!.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
