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
// - Transfer ownership is only on other rows for the OWNER
// - Transfer confirms first; cancel does not write
// - Make admin and Remove admin are in the permission menu
// - Self-demote confirms first; cancel does not write
// - After a self-demote the modal no longer lets the viewer administer
// - An occupancy miss shows the conflict and refreshes the row from the server
// - A miss that already matches the requested role updates silently
// - A self-demote that lost a race does not leave administer controls enabled
// - Optimistic transfer moves both labels; a failure rolls back
// - Owner leave is disabled with the transfer explanation
// - An admin or member can confirm leaving
//
// What is covered:
// - Invite, owner row, permission menu, read-only member view, copy,
//   transfer, leave
//
// Run with: pnpm test:run tests/components/projects/ShareModalBody.test.tsx
//
// SEE: src/components/projects/ShareModalBody.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import {
  CANT_INVITE_USER_MESSAGE,
  MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
  OWNER_MUST_TRANSFER_MESSAGE,
  REMOVE_ADMIN_SELF_DESCRIPTION,
  TRANSFER_OWNERSHIP_DESCRIPTION,
} from '@/lib/messages';
import type { ShareMember } from '@/components/projects/boardTypes';

const createInvitation = vi.fn();
const updateMembershipAccess = vi.fn();
const updateMembershipRole = vi.fn();
const removeMember = vi.fn();
const updatePublicLink = vi.fn();
const transferOwnership = vi.fn();
const leaveProject = vi.fn();
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock('@/actions/createInvitation', () => ({
  createInvitation,
}));
vi.mock('@/actions/updateMembershipAccess', () => ({
  updateMembershipAccess,
}));
vi.mock('@/actions/updateMembershipRole', () => ({
  updateMembershipRole,
}));
vi.mock('@/actions/removeMember', () => ({
  removeMember,
}));
vi.mock('@/actions/updatePublicLink', () => ({
  updatePublicLink,
}));
vi.mock('@/actions/transferOwnership', () => ({
  transferOwnership,
}));
vi.mock('@/actions/leaveProject', () => ({
  leaveProject,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
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
      currentUserId="user-ada"
      canAdminister
      publicLinkEnabled={false}
      shareUrl="https://wrapit.example/projects/project-1"
      copied={false}
      onCopied={() => {}}
      onAccessChange={() => {}}
      onRoleChange={() => {}}
      onRemoved={() => {}}
      onOwnershipChange={() => {}}
      onPublicLinkChange={() => {}}
      {...props}
    />,
  );
}

function StatefulBody({
  initialMembers,
  currentUserId = 'user-ada',
}: {
  initialMembers: ShareMember[];
  currentUserId?: string;
}) {
  const [shareMembers, setShareMembers] = useState(initialMembers);
  return (
    <ShareModalBody
      projectId="project-1"
      members={shareMembers}
      currentUserId={currentUserId}
      canAdminister
      publicLinkEnabled={false}
      shareUrl="https://wrapit.example/projects/project-1"
      copied={false}
      onCopied={() => {}}
      onAccessChange={() => {}}
      onRoleChange={(membershipId, next) => {
        setShareMembers((current) =>
          current.map((member) =>
            member.membershipId === membershipId
              ? { ...member, role: next.role, access: next.access }
              : member,
          ),
        );
      }}
      onRemoved={() => {}}
      onOwnershipChange={() => {}}
      onPublicLinkChange={() => {}}
    />
  );
}

describe('ShareModalBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createInvitation.mockResolvedValue({ data: { id: 'invite-1' } });
    updateMembershipAccess.mockResolvedValue({ data: { access: 'VIEW' } });
    updateMembershipRole.mockResolvedValue({ data: { role: 'ADMIN', access: 'EDIT' } });
    transferOwnership.mockResolvedValue({ data: { membershipId: 'mem-max' } });
    leaveProject.mockResolvedValue({ data: { projectId: 'project-1' } });
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
    renderBody({ canAdminister: false, currentUserId: 'user-max' });

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

  it('offers Transfer ownership only on other rows when the viewer is OWNER', async () => {
    const events = userEvent.setup();
    renderBody();

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    expect(screen.getByRole('menuitem', { name: 'Transfer ownership' })).toBeInTheDocument();
  });

  it('hides Transfer ownership when the viewer is an ADMIN', async () => {
    const events = userEvent.setup();
    renderBody({
      currentUserId: 'user-ada',
      members: [
        { ...members[0]!, role: 'ADMIN' },
        {
          id: 'user-owner',
          membershipId: 'mem-owner',
          name: 'Owner',
          username: 'owner',
          role: 'OWNER',
          access: 'EDIT',
        },
        members[1]!,
      ],
    });

    const memberControl = screen
      .getAllByRole('button', { name: 'Change permission' })
      .find((button) => button.textContent?.includes('Can comment'));
    await events.click(memberControl!);
    expect(screen.queryByRole('menuitem', { name: 'Transfer ownership' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Make admin' })).toBeInTheDocument();
  });

  it('confirms transfer before writing and cancel does not call the action', async () => {
    const events = userEvent.setup();
    renderBody();

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitem', { name: 'Transfer ownership' }));

    expect(screen.getByText(TRANSFER_OWNERSHIP_DESCRIPTION)).toBeInTheDocument();
    await events.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(transferOwnership).not.toHaveBeenCalled();
    expect(screen.queryByText(TRANSFER_OWNERSHIP_DESCRIPTION)).not.toBeInTheDocument();
  });

  it('moves Owner to the target immediately and rolls back when transfer fails', async () => {
    const events = userEvent.setup();
    let finish: (result: { error: string }) => void = () => {};
    transferOwnership.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderBody();

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitem', { name: 'Transfer ownership' }));
    await events.click(screen.getByRole('button', { name: 'Transfer ownership' }));

    await waitFor(() => {
      expect(screen.getByText('Maxi').closest('div')?.parentElement).toHaveTextContent('Owner');
    });

    finish({ error: 'Unauthorized' });

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace').closest('div')?.parentElement).toHaveTextContent(
        'Owner',
      );
      expect(screen.getByText('Maxi').closest('div')?.parentElement).toHaveTextContent(
        'Can comment',
      );
    });
  });

  it('disables Leave project for the owner and shows the transfer explanation', () => {
    renderBody();

    expect(screen.getByRole('button', { name: 'Leave project' })).toBeDisabled();
    expect(screen.getByText(OWNER_MUST_TRANSFER_MESSAGE)).toBeInTheDocument();
  });

  it('lets a member confirm leaving and then navigates to projects', async () => {
    const events = userEvent.setup();
    renderBody({ canAdminister: false, currentUserId: 'user-max' });

    await events.click(screen.getByRole('button', { name: 'Leave project' }));
    await events.click(screen.getByRole('button', { name: 'Leave project' }));

    expect(leaveProject).toHaveBeenCalledWith({ projectId: 'project-1' });
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith('/projects');
      expect(routerRefresh).toHaveBeenCalled();
    });
  });

  it('offers Make admin on a member row', async () => {
    const events = userEvent.setup();
    renderBody();

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitem', { name: 'Make admin' }));

    expect(updateMembershipRole).toHaveBeenCalledWith({
      projectId: 'project-1',
      membershipId: 'mem-max',
      role: 'ADMIN',
    });
  });

  it('confirms self-demote first and cancel does not call the action', async () => {
    const events = userEvent.setup();
    renderBody({
      currentUserId: 'user-ada',
      members: [
        { ...members[0]!, role: 'ADMIN' },
        {
          id: 'user-owner',
          membershipId: 'mem-owner',
          name: 'Owner',
          username: 'owner',
          role: 'OWNER',
          access: 'EDIT',
        },
        members[1]!,
      ],
    });

    await events.click(
      screen
        .getAllByRole('button', { name: 'Change permission' })
        .find((button) => button.textContent?.includes('Admin'))!,
    );
    await events.click(screen.getByRole('menuitem', { name: 'Remove admin' }));

    expect(screen.getByText(REMOVE_ADMIN_SELF_DESCRIPTION)).toBeInTheDocument();
    await events.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateMembershipRole).not.toHaveBeenCalled();
    expect(screen.queryByText(REMOVE_ADMIN_SELF_DESCRIPTION)).not.toBeInTheDocument();
  });

  it('stops administering the modal after a confirmed self-demote', async () => {
    const events = userEvent.setup();
    updateMembershipRole.mockResolvedValue({ data: { role: 'MEMBER', access: 'EDIT' } });

    function Body() {
      const [shareMembers, setShareMembers] = useState([
        { ...members[0]!, role: 'ADMIN' as const },
        {
          id: 'user-owner',
          membershipId: 'mem-owner',
          name: 'Owner',
          username: 'owner',
          role: 'OWNER' as const,
          access: 'EDIT' as const,
        },
        members[1]!,
      ]);
      return (
        <ShareModalBody
          projectId="project-1"
          members={shareMembers}
          currentUserId="user-ada"
          canAdminister
          publicLinkEnabled={false}
          shareUrl="https://wrapit.example/projects/project-1"
          copied={false}
          onCopied={() => {}}
          onAccessChange={() => {}}
          onRoleChange={(membershipId, next) => {
            setShareMembers((current) =>
              current.map((member) =>
                member.membershipId === membershipId
                  ? { ...member, role: next.role, access: next.access }
                  : member,
              ),
            );
          }}
          onRemoved={() => {}}
          onOwnershipChange={() => {}}
          onPublicLinkChange={() => {}}
        />
      );
    }

    render(<Body />);

    await events.click(
      screen
        .getAllByRole('button', { name: 'Change permission' })
        .find((button) => button.textContent?.includes('Admin'))!,
    );
    await events.click(screen.getByRole('menuitem', { name: 'Remove admin' }));
    await events.click(screen.getByRole('button', { name: 'Remove admin' }));

    expect(updateMembershipRole).toHaveBeenCalledWith({
      projectId: 'project-1',
      membershipId: 'mem-ada',
      role: 'MEMBER',
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Username')).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Change permission' })).not.toBeInTheDocument();
  });

  it('keeps the conflict message visible and refreshes the row after an occupancy miss', async () => {
    const events = userEvent.setup();
    updateMembershipRole.mockResolvedValue({
      error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
      current: { role: 'MEMBER', access: 'VIEW' },
    });
    render(<StatefulBody initialMembers={members} />);

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitem', { name: 'Make admin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
    );
    expect(screen.getByText('Maxi').closest('div')?.parentElement).toHaveTextContent('View only');
    expect(screen.getByText('Maxi').closest('div')?.parentElement).not.toHaveTextContent('Admin');
    expect(screen.getByText('Maxi').closest('div')?.parentElement).not.toHaveTextContent(
      'Can comment',
    );
  });

  it('updates the row silently when occupancy already holds the requested role', async () => {
    const events = userEvent.setup();
    updateMembershipRole.mockResolvedValue({
      error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
      current: { role: 'ADMIN', access: 'EDIT' },
    });
    render(<StatefulBody initialMembers={members} />);

    await events.click(screen.getByRole('button', { name: 'Change permission' }));
    await events.click(screen.getByRole('menuitem', { name: 'Make admin' }));

    await waitFor(() => {
      expect(screen.getByText('Maxi').closest('div')?.parentElement).toHaveTextContent('Admin');
    });
    expect(screen.queryByText(MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE)).not.toBeInTheDocument();
  });

  it('does not re-enable administer controls after a self-demote occupancy miss', async () => {
    const events = userEvent.setup();
    updateMembershipRole.mockResolvedValue({
      error: MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE,
      current: { role: 'MEMBER', access: 'EDIT' },
    });
    render(
      <StatefulBody
        initialMembers={[
          { ...members[0]!, role: 'ADMIN' },
          {
            id: 'user-owner',
            membershipId: 'mem-owner',
            name: 'Owner',
            username: 'owner',
            role: 'OWNER',
            access: 'EDIT',
          },
          members[1]!,
        ]}
      />,
    );

    await events.click(
      screen
        .getAllByRole('button', { name: 'Change permission' })
        .find((button) => button.textContent?.includes('Admin'))!,
    );
    await events.click(screen.getByRole('menuitem', { name: 'Remove admin' }));
    await events.click(screen.getByRole('button', { name: 'Remove admin' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Username')).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Change permission' })).not.toBeInTheDocument();
    expect(screen.queryByText(MEMBERSHIP_ROLE_CHANGED_ELSEWHERE_MESSAGE)).not.toBeInTheDocument();
  });
});
