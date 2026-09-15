// tests/components/projects/MemberPopover.test.tsx
//
// Tests for the board-header member avatar popover.
//
// Tested:
// - Below lg the trigger is a Members icon that lists every member when opened
// - Desktop shows at most three avatars and an overflow control for the rest
// - First and last avatars on a narrow viewport keep the popover in bounds
//
// What is covered:
// - Compact members list through tablet, desktop avatar cap, viewport clamping for edge avatars
//
// Run with: pnpm test:run tests/components/projects/MemberPopover.test.tsx
//
// SEE: src/components/projects/MemberPopover.tsx

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MemberPopover, { BOARD_VISIBLE_MEMBER_AVATARS } from '@/components/projects/MemberPopover';
import { MEMBER_POPOVER_VIEWPORT_INSET_PX } from '@/components/projects/memberPopoverPosition';
import { OpenPanelProvider } from '@/components/projects/OpenPanel';

const POPOVER_WIDTH = 170;
const AVATAR_SIZE = 30;
const VIEWPORT_WIDTH = 360;
const INSET = MEMBER_POPOVER_VIEWPORT_INSET_PX;

const members = [
  { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' },
  { id: 'user-ben', name: 'Ben', username: 'ben' },
  { id: 'user-cara', name: 'Cara', username: 'cara' },
];

function domRect(left: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right: left + width,
    top: 0,
    bottom: height,
    width,
    height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function stubAvatarRects(avatarLeftByName: Record<string, number>) {
  vi.stubGlobal('innerWidth', VIEWPORT_WIDTH);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('role') === 'dialog') {
      return domRect(0, POPOVER_WIDTH, 80);
    }
    const name = this.getAttribute('aria-label');
    if (this.tagName === 'BUTTON' && name && name in avatarLeftByName) {
      return domRect(avatarLeftByName[name]!, AVATAR_SIZE, AVATAR_SIZE);
    }
    return domRect(0, 0, 0);
  });
}

function popoverViewportBox(avatarLeft: number, dialog: HTMLElement) {
  const left = avatarLeft + Number.parseFloat(dialog.style.left);
  return { left, right: left + POPOVER_WIDTH };
}

describe('MemberPopover', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens a members list from the phone icon', async () => {
    const events = userEvent.setup();
    render(
      <OpenPanelProvider>
        <MemberPopover members={members} />
      </OpenPanelProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Members' });
    expect(trigger).toHaveClass('size-10');
    expect(trigger.parentElement).toHaveClass('lg:hidden');
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Members' })).not.toBeInTheDocument();

    await events.click(trigger);
    const list = screen.getByRole('dialog', { name: 'Members' });
    expect(list).toHaveTextContent('Ada Lovelace');
    expect(list).toHaveTextContent('@ada');
    expect(list).toHaveTextContent('Ben');
    expect(list).toHaveTextContent('Cara');
  });

  it('caps desktop avatars and lists the rest from the overflow control', async () => {
    const events = userEvent.setup();
    const extra = [
      ...members,
      { id: 'user-dan', name: 'Dan', username: 'dan' },
      { id: 'user-eve', name: 'Eve', username: 'eve' },
    ];
    expect(extra.length).toBeGreaterThan(BOARD_VISIBLE_MEMBER_AVATARS);

    render(
      <OpenPanelProvider>
        <MemberPopover members={extra} />
      </OpenPanelProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Ada Lovelace' }).parentElement?.parentElement,
    ).toHaveClass('hidden', 'lg:flex');
    expect(screen.getByRole('button', { name: 'Cara' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dan' })).not.toBeInTheDocument();
    const overflow = extra.length - BOARD_VISIBLE_MEMBER_AVATARS;
    await events.click(screen.getByRole('button', { name: `${overflow} more members` }));
    const list = screen.getByRole('dialog', { name: 'Members' });
    expect(list).toHaveTextContent('Dan');
    expect(list).toHaveTextContent('Eve');
  });

  it('does not render an overflow control when every avatar fits', () => {
    render(
      <OpenPanelProvider>
        <MemberPopover members={members} />
      </OpenPanelProvider>,
    );

    expect(screen.queryByRole('button', { name: /more members/ })).not.toBeInTheDocument();
  });

  it('keeps the first and last avatar popovers inside a narrow viewport', async () => {
    const events = userEvent.setup();
    const firstLeft = 0;
    const lastLeft = VIEWPORT_WIDTH - AVATAR_SIZE;
    stubAvatarRects({
      'Ada Lovelace': firstLeft,
      Cara: lastLeft,
    });

    render(
      <OpenPanelProvider>
        <MemberPopover members={members} />
      </OpenPanelProvider>,
    );

    await events.click(screen.getByRole('button', { name: 'Ada Lovelace' }));
    const firstDialog = screen.getByRole('dialog', { name: 'Ada Lovelace' });
    const firstBox = popoverViewportBox(firstLeft, firstDialog);
    expect(firstBox.left).toBeGreaterThanOrEqual(INSET);
    expect(firstBox.right).toBeLessThanOrEqual(VIEWPORT_WIDTH - INSET);

    await events.click(screen.getByRole('button', { name: 'Close member' }));

    await events.click(screen.getByRole('button', { name: 'Cara' }));
    const lastDialog = screen.getByRole('dialog', { name: 'Cara' });
    const lastBox = popoverViewportBox(lastLeft, lastDialog);
    expect(lastBox.left).toBeGreaterThanOrEqual(INSET);
    expect(lastBox.right).toBeLessThanOrEqual(VIEWPORT_WIDTH - INSET);
  });
});
