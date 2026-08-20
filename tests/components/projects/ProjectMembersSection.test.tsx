// tests/components/projects/ProjectMembersSection.test.tsx
//
// Tests for the project detail Members section.
//
// Tested:
// - Lists current members with name and role
// - Invites by username through createInvitation
// - Shows the generic can't-invite message on a denied invite
//
// What is covered:
// - Member list, invite success, generic invite error
//
// Run with: pnpm test:run tests/components/projects/ProjectMembersSection.test.tsx
//
// SEE: src/components/projects/ProjectMembersSection.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CANT_INVITE_USER_MESSAGE } from '@/lib/messages';

const createInvitation = vi.fn();

vi.mock('@/actions/createInvitation', () => ({
  createInvitation,
}));

const { default: ProjectMembersSection } =
  await import('@/components/projects/ProjectMembersSection');

const members = [
  { userId: 'user-ada', name: 'Ada Lovelace', username: 'ada', role: 'OWNER' as const },
  { userId: 'user-max', name: 'Maxi', username: 'maxi', role: 'MEMBER' as const },
];

describe('ProjectMembersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createInvitation.mockResolvedValue({
      data: { id: 'invite-1', projectId: 'project-1', status: 'PENDING' },
    });
  });

  it('lists members with avatar initials, name, and role', () => {
    render(<ProjectMembersSection projectId="project-1" members={members} />);

    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Maxi')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('invites by username', async () => {
    const events = userEvent.setup();
    render(<ProjectMembersSection projectId="project-1" members={members} />);

    await events.type(screen.getByLabelText('Invite by username'), 'linus');
    await events.click(screen.getByRole('button', { name: 'Invite' }));

    await waitFor(() => {
      expect(createInvitation).toHaveBeenCalledWith({
        projectId: 'project-1',
        username: 'linus',
      });
    });
    expect(screen.getByLabelText('Invite by username')).toHaveValue('');
  });

  it('shows the generic error when the user cannot be invited', async () => {
    createInvitation.mockResolvedValueOnce({ error: CANT_INVITE_USER_MESSAGE });
    const events = userEvent.setup();
    render(<ProjectMembersSection projectId="project-1" members={members} />);

    await events.type(screen.getByLabelText('Invite by username'), 'nobody');
    await events.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByText(CANT_INVITE_USER_MESSAGE)).toBeInTheDocument();
  });
});
