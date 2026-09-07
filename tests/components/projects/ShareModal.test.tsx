// tests/components/projects/ShareModal.test.tsx
//
// Tests for the Share modal phone sheet pin.
//
// Tested:
// - The phone sheet pins to the edges of the safe-fixed root
//
// What is covered:
// - Sheet pin classes and portal parent
//
// Run with: pnpm test:run tests/components/projects/ShareModal.test.tsx
//
// SEE: src/components/projects/ShareModal.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/actions/createInvitation', () => ({ createInvitation: vi.fn() }));
vi.mock('@/actions/updateMembershipAccess', () => ({ updateMembershipAccess: vi.fn() }));
vi.mock('@/actions/updateMembershipRole', () => ({ updateMembershipRole: vi.fn() }));
vi.mock('@/actions/removeMember', () => ({ removeMember: vi.fn() }));
vi.mock('@/actions/transferOwnership', () => ({ transferOwnership: vi.fn() }));
vi.mock('@/actions/leaveProject', () => ({ leaveProject: vi.fn() }));
vi.mock('@/actions/updatePublicLink', () => ({ updatePublicLink: vi.fn() }));

const { default: ShareModal } = await import('@/components/projects/ShareModal');

describe('ShareModal', () => {
  it('pins the phone sheet to the edges of the safe-fixed root', () => {
    render(
      <ShareModal
        open
        onOpenChange={vi.fn()}
        projectId="proj-1"
        projectTitle="Sprint board"
        members={[
          {
            id: 'user-ada',
            membershipId: 'mem-ada',
            name: 'Ada Lovelace',
            username: 'ada',
            role: 'OWNER',
            access: 'EDIT',
          },
        ]}
        currentUserId="user-ada"
        canAdminister
        publicLinkEnabled={false}
        onAccessChange={vi.fn()}
        onRoleChange={vi.fn()}
        onRemoved={vi.fn()}
        onOwnershipChange={vi.fn()}
        onPublicLinkChange={vi.fn()}
      />,
    );

    const sheet = screen.getByRole('dialog', { name: 'Share board' });
    expect(sheet).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
    expect(sheet.parentElement?.id).toBe('safe-fixed-root');
    expect(sheet.className).not.toMatch(/safe-area-inset/);
  });
});
