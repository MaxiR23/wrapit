// tests/components/projects/ShareModalBody.test.tsx
//
// Tests for the shared Share modal body.
//
// Tested:
// - Invites by username through createInvitation
// - Owner row has no permission control
// - Admins can open the permission menu and pick an access
// - Non-admins see the list and link but cannot invite or change access
// - Copy confirms with Copied
//
// What is covered:
// - Invite, owner row, permission menu, read-only member view, copy
//
// Run with: pnpm test:run tests/components/projects/ShareModalBody.test.tsx
//
// SEE: src/components/projects/ShareModalBody.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CANT_INVITE_USER_MESSAGE } from '@/lib/messages';
import type { ShareMember } from '@/components/projects/boardTypes';

const createInvitation = vi.fn();
const updateMembershipAccess = vi.fn();
const removeMember = vi.fn();
const updatePublicLink = vi.fn();

vi.mock('@/actions/createInvitation', () => ({
  createInvitation,
}));
vi.mock('@/actions/updateMembershipAccess', () => ({
  updateMembershipAccess,
}));
vi.mock('@/actions/removeMember', () => ({
  removeMember,
}));
vi.mock('@/actions/updatePublicLink', () => ({
  updatePublicLink,
}));

const { default: ShareModalBody } = await import('@/components/projects/ShareModalBody');

const members: ShareMember[] = [
  {
    id: 'user-ada',
    membershipId: 'mem-ada',
    name: 'Ada Lovelace',
    username: 'ada',
    role: 'OWNER',
    access: 'EDIT',
  },
  {
    id: 'user-max',
    membershipId: 'mem-max',
    name: 'Maxi',
    username: 'maxi',
    role: 'MEMBER',
    access: 'COMMENT',
  },
];

function renderBody(
  props: Partial<Parameters<typeof ShareModalBody>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <ShareModalBody
      projectId="project-1"
      members={members}
      canAdminister
      publicLinkEnabled={false}
      shareUrl="https://wrapit.example/projects/project-1"
      copied={false}
      onCopied={() => {}}
      onAccessChange={() => {}}
      onRemoved={() => {}}
      onPublicLinkChange={() => {}}
      {...props}
    />,
  );
}

describe('ShareModalBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createInvitation.mockResolvedValue({ data: { id: 'invite-1' } });
    updateMembershipAccess.mockResolvedValue({ data: { access: 'VIEW' } });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('invites by username through createInvitation', async () => {
    const events = userEvent.setup();
    renderBody();

    await events.type(screen.getByLabelText('Username'), 'grace');
    await events.click(screen.getByRole('button', { name: 'Invite' }));

    expect(createInvitation).toHaveBeenCalledWith({ projectId: 'project-1', username: 'grace' });
  });

  it('shows the generic invite error', async () => {
    const events = userEvent.setup();
    createInvitation.mockResolvedValueOnce({ error: CANT_INVITE_USER_MESSAGE });
    renderBody();

    await events.type(screen.getByLabelText('Username'), 'nobody');
    await events.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(CANT_INVITE_USER_MESSAGE);
  });

  it('shows Owner with no permission control', () => {
    renderBody();

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change permission' })).not.toHaveTextContent(
      'Owner',
    );
    const controls = screen.getAllByRole('button', { name: 'Change permission' });
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveTextContent('Can comment');
  });

  it('lets an admin pick View only for a member', async () => {
    const events = userEvent.setup();
    const onAccessChange = vi.fn();
    renderBody({ onAccessChange });

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitemradio', { name: 'View only' }));

    expect(updateMembershipAccess).toHaveBeenCalledWith({
      projectId: 'project-1',
      membershipId: 'mem-max',
      access: 'VIEW',
    });
  });

  it('lets a non-admin see the list and link but change nothing', () => {
    renderBody({ canAdminister: false });

    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Change permission' })).not.toBeInTheDocument();
    expect(screen.getByText('Anyone with the link can view the board')).toBeInTheDocument();
    expect(screen.getByText('https://wrapit.example/projects/project-1')).toBeInTheDocument();
  });

  it('confirms copy', async () => {
    const events = userEvent.setup();
    const onCopied = vi.fn();
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderBody({ onCopied, copied: false });

    await events.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeSpy).toHaveBeenCalledWith('https://wrapit.example/projects/project-1');
    expect(onCopied).toHaveBeenCalled();
  });

  it('shows Copied after a successful copy', () => {
    renderBody({ copied: true });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
