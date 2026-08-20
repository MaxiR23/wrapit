// tests/components/account/VisibilityDropdown.test.tsx
//
// Tests for the reusable profile visibility menu.
//
// Tested:
// - Only one dropdown is open at a time
// - Picking an option calls onChange and closes the menu
// - Escape closes the open menu
// - ArrowDown moves focus through options without changing the value until Enter
//
// What is covered:
// - Single-open, select, Escape, keyboard focus vs selection
//
// Run with: pnpm test:run tests/components/account/VisibilityDropdown.test.tsx
//
// SEE: src/components/account/VisibilityDropdown.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import VisibilityDropdown from '@/components/account/VisibilityDropdown';
import { VisibilityMenuProvider } from '@/components/account/VisibilityMenuProvider';

function Pair() {
  return (
    <VisibilityMenuProvider>
      <VisibilityDropdown menuKey="photo" label="Profile photo" value="anyone" onChange={vi.fn()} />
      <VisibilityDropdown menuKey="email" label="Email address" value="admins" onChange={vi.fn()} />
    </VisibilityMenuProvider>
  );
}

describe('VisibilityDropdown', () => {
  it('keeps only one menu open at a time', async () => {
    const events = userEvent.setup();
    render(<Pair />);

    await events.click(screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }));
    expect(screen.getByRole('menu', { name: 'Visibility' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await events.click(
      screen.getByRole('button', { name: 'Email address visibility: You and admins only' }),
    );
    expect(screen.getAllByRole('menu', { name: 'Visibility' })).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: 'Email address visibility: You and admins only' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onChange and closes when an option is picked', async () => {
    const onChange = vi.fn();
    const events = userEvent.setup();
    render(
      <VisibilityMenuProvider>
        <VisibilityDropdown
          menuKey="photo"
          label="Profile photo"
          value="anyone"
          onChange={onChange}
        />
      </VisibilityMenuProvider>,
    );

    await events.click(screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }));
    await events.click(screen.getByRole('menuitem', { name: 'Team only' }));

    expect(onChange).toHaveBeenCalledWith('team');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const events = userEvent.setup();
    render(<Pair />);

    await events.click(screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await events.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves focus with ArrowDown without changing the value until Enter', async () => {
    const onChange = vi.fn();
    const events = userEvent.setup();
    render(
      <VisibilityMenuProvider>
        <VisibilityDropdown
          menuKey="photo"
          label="Profile photo"
          value="anyone"
          onChange={onChange}
        />
      </VisibilityMenuProvider>,
    );

    await events.click(screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }));
    await events.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    expect(screen.getByRole('menuitem', { name: 'You and admins only' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Profile photo visibility: Anyone' }),
    ).toBeInTheDocument();

    await events.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('admins');
  });
});
