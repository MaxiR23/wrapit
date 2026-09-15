// tests/lib/accountUser.test.ts
//
// Tests that account profile and statuses share one request-scoped user read.
//
// Tested:
// - getUserProfileForUser and getUserStatusesForUser call user.findUnique once
//
// What is covered:
// - React.cache on getAccountUser. jsdom's client React makes cache() a no-op,
//   so this file installs a request-scoped stand-in.
//
// Run with: pnpm test:run tests/lib/accountUser.test.ts
//
// SEE: src/lib/accountUser.ts, src/lib/userProfile.ts, src/lib/userStatuses.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRequestCache } from '../helpers/requestCache';
import { createPrismaFake } from '../helpers/prismaFake';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { cache } = await import('../helpers/requestCache');
  return { ...actual, cache };
});

const db = createPrismaFake();
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { getUserProfileForUser } = await import('@/lib/userProfile');
const { getUserStatusesForUser } = await import('@/lib/userStatuses');

describe('getAccountUser request memo', () => {
  beforeEach(() => {
    db.reset();
    resetRequestCache();
  });

  it('shares one user.findUnique between profile and statuses', async () => {
    await db.user.create({
      data: {
        id: 'user-ada',
        name: 'Ada Lovelace',
        username: 'ada',
        email: 'ada@example.com',
      },
    });
    db.user.findUnique.mockClear();

    const [profile, statuses] = await Promise.all([
      getUserProfileForUser('user-ada'),
      getUserStatusesForUser('user-ada'),
    ]);

    expect(profile?.username).toBe('ada');
    expect(statuses?.statuses.length).toBeGreaterThan(0);
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
