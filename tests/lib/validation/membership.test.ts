// tests/lib/validation/membership.test.ts
//
// Tests for share-modal membership action schemas.
//
// Tested:
// - Accepts bounded ids and a known access value
// - Rejects an empty or oversized id without coercion
// - Rejects an unknown access value
//
// What is covered:
// - Happy path, invalid id, invalid access
//
// Run with: pnpm test:run tests/lib/validation/membership.test.ts
//
// SEE: src/lib/validation/membership.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  leaveProjectSchema,
  removeMemberSchema,
  transferOwnershipSchema,
  updateMembershipAccessSchema,
  updatePublicLinkSchema,
} from '@/lib/validation/membership';

describe('updateMembershipAccessSchema', () => {
  it('accepts bounded ids and a known access value', () => {
    expect(
      updateMembershipAccessSchema.parse({
        projectId: 'project-1',
        membershipId: 'mem-1',
        access: 'COMMENT',
      }),
    ).toEqual({
      projectId: 'project-1',
      membershipId: 'mem-1',
      access: 'COMMENT',
    });
  });

  it('rejects an empty or oversized id', () => {
    expect(
      updateMembershipAccessSchema.safeParse({
        projectId: '',
        membershipId: 'mem-1',
        access: 'EDIT',
      }).success,
    ).toBe(false);
    expect(
      updateMembershipAccessSchema.safeParse({
        projectId: 'p'.repeat(MAX_ID_LENGTH + 1),
        membershipId: 'mem-1',
        access: 'EDIT',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown access value', () => {
    expect(
      updateMembershipAccessSchema.safeParse({
        projectId: 'project-1',
        membershipId: 'mem-1',
        access: 'OWNER',
      }).success,
    ).toBe(false);
  });
});

describe('removeMemberSchema', () => {
  it('accepts bounded project and membership ids', () => {
    expect(removeMemberSchema.parse({ projectId: 'project-1', membershipId: 'mem-1' })).toEqual({
      projectId: 'project-1',
      membershipId: 'mem-1',
    });
  });
});

describe('leaveProjectSchema', () => {
  it('accepts a bounded project id', () => {
    expect(leaveProjectSchema.parse({ projectId: 'project-1' })).toEqual({
      projectId: 'project-1',
    });
  });

  it('rejects an empty or oversized id', () => {
    expect(leaveProjectSchema.safeParse({ projectId: '' }).success).toBe(false);
    expect(leaveProjectSchema.safeParse({ projectId: 'p'.repeat(MAX_ID_LENGTH + 1) }).success).toBe(
      false,
    );
  });
});

describe('transferOwnershipSchema', () => {
  it('accepts bounded project and membership ids', () => {
    expect(
      transferOwnershipSchema.parse({ projectId: 'project-1', membershipId: 'mem-1' }),
    ).toEqual({
      projectId: 'project-1',
      membershipId: 'mem-1',
    });
  });
});

describe('updatePublicLinkSchema', () => {
  it('accepts a bounded project id and a boolean', () => {
    expect(updatePublicLinkSchema.parse({ projectId: 'project-1', enabled: true })).toEqual({
      projectId: 'project-1',
      enabled: true,
    });
  });
});
