// tests/lib/validation/invitation.test.ts
//
// Tests for invite, accept, and reject schemas.
//
// Tested:
// - Invitation role defaults to MEMBER when omitted
// - Accepts ADMIN or MEMBER
// - Rejects OWNER and an unknown role
// - Accept and reject require a bounded invitation id
//
// What is covered:
// - Happy path, default role, invalid role, invalid id
//
// Run with: pnpm test:run tests/lib/validation/invitation.test.ts
//
// SEE: src/lib/validation/invitation.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  acceptInvitationSchema,
  invitationSchema,
  rejectInvitationSchema,
} from '@/lib/validation/invitation';

describe('invitationSchema', () => {
  it('defaults role to MEMBER when omitted', () => {
    expect(invitationSchema.parse({ projectId: 'project-1', username: 'maxi' })).toEqual({
      projectId: 'project-1',
      username: 'maxi',
      role: 'MEMBER',
    });
  });

  it('accepts ADMIN or MEMBER', () => {
    expect(
      invitationSchema.parse({ projectId: 'project-1', username: 'maxi', role: 'ADMIN' }),
    ).toEqual({
      projectId: 'project-1',
      username: 'maxi',
      role: 'ADMIN',
    });
    expect(
      invitationSchema.parse({ projectId: 'project-1', username: 'maxi', role: 'MEMBER' }),
    ).toEqual({
      projectId: 'project-1',
      username: 'maxi',
      role: 'MEMBER',
    });
  });

  it('rejects OWNER and an unknown role', () => {
    expect(
      invitationSchema.safeParse({ projectId: 'project-1', username: 'maxi', role: 'OWNER' })
        .success,
    ).toBe(false);
    expect(
      invitationSchema.safeParse({ projectId: 'project-1', username: 'maxi', role: 'VIEW' })
        .success,
    ).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('accepts a bounded invitation id', () => {
    expect(acceptInvitationSchema.parse({ invitationId: 'invite-1' })).toEqual({
      invitationId: 'invite-1',
    });
  });

  it('rejects an empty or oversized id', () => {
    expect(acceptInvitationSchema.safeParse({ invitationId: '' }).success).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({ invitationId: 'i'.repeat(MAX_ID_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('rejectInvitationSchema', () => {
  it('accepts a bounded invitation id', () => {
    expect(rejectInvitationSchema.parse({ invitationId: 'invite-1' })).toEqual({
      invitationId: 'invite-1',
    });
  });
});
