// tests/lib/userProfile.test.ts
//
// Tests for reading a user profile and mapping Prisma visibility values.
//
// Tested:
// - Returns stored profile fields when a row exists
// - Falls back to empty fields and default visibilities when no row exists
// - Maps unknown Prisma visibilities to anyone, except a missing email column stays admins
// - Returns null when the user does not exist
//
// What is covered:
// - Stored row, missing row, unknown enum, missing user
//
// Run with: pnpm test:run tests/lib/userProfile.test.ts
//
// SEE: src/lib/userProfile.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createPrismaFake } from '../helpers/prismaFake';

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const {
  getUserProfileForUser,
  parseProfileVisibility,
  profileFromUserAndRow,
  toPrismaProfileVisibility,
  visibilitiesFromRow,
} = await import('@/lib/userProfile');

const ada = {
  id: 'user-ada',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  username: 'ada',
};

describe('parseProfileVisibility', () => {
  it('maps Prisma members and everything else to anyone', () => {
    expect(parseProfileVisibility('ANYONE')).toBe('anyone');
    expect(parseProfileVisibility('TEAM')).toBe('team');
    expect(parseProfileVisibility('ADMINS_ONLY')).toBe('admins');
    expect(parseProfileVisibility('secret')).toBe('anyone');
    expect(parseProfileVisibility(undefined)).toBe('anyone');
  });
});

describe('toPrismaProfileVisibility', () => {
  it('maps UI values to Prisma enum members', () => {
    expect(toPrismaProfileVisibility('anyone')).toBe('ANYONE');
    expect(toPrismaProfileVisibility('team')).toBe('TEAM');
    expect(toPrismaProfileVisibility('admins')).toBe('ADMINS_ONLY');
  });
});

describe('visibilitiesFromRow', () => {
  it('defaults email to admins and every other field to anyone when the row is missing', () => {
    expect(visibilitiesFromRow(null)).toEqual({
      photo: 'anyone',
      fullName: 'anyone',
      publicName: 'anyone',
      pronouns: 'anyone',
      jobTitle: 'anyone',
      department: 'anyone',
      organization: 'anyone',
      location: 'anyone',
      localTime: 'anyone',
      workingWithYou: 'anyone',
      email: 'admins',
    });
  });
});

describe('profileFromUserAndRow', () => {
  it('uses User.name and User.email rather than duplicating them on the profile row', () => {
    const view = profileFromUserAndRow(ada, {
      fullName: 'Augusta Ada King',
      pronouns: 'she/her',
    });

    expect(view.name).toBe('Ada Lovelace');
    expect(view.email).toBe('ada@example.com');
    expect(view.username).toBe('ada');
    expect(view.fullName).toBe('Augusta Ada King');
    expect(view.pronouns).toBe('she/her');
    expect(view.visibilities.email).toBe('admins');
  });
});

describe('getUserProfileForUser', () => {
  beforeEach(() => {
    db.reset();
  });

  it('returns stored fields when a profile row exists', async () => {
    await db.user.create({ data: ada });
    await db.userProfile.create({
      data: {
        userId: ada.id,
        fullName: 'Augusta Ada King',
        jobTitle: 'Mathematician',
        emailVisibility: 'TEAM',
      },
    });

    const view = await getUserProfileForUser(ada.id);
    expect(view?.fullName).toBe('Augusta Ada King');
    expect(view?.jobTitle).toBe('Mathematician');
    expect(view?.visibilities.email).toBe('team');
    expect(view?.name).toBe('Ada Lovelace');
  });

  it('falls back to empty fields when no profile row exists', async () => {
    await db.user.create({ data: ada });

    const view = await getUserProfileForUser(ada.id);
    expect(view?.fullName).toBe('');
    expect(view?.workingWithYou).toBe('');
    expect(view?.visibilities.email).toBe('admins');
    expect(view?.visibilities.photo).toBe('anyone');
    expect(db.userProfile.rows).toHaveLength(0);
  });

  it('returns null when the user does not exist', async () => {
    await expect(getUserProfileForUser('missing')).resolves.toBeNull();
  });
});
