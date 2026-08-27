// tests/lib/routes.test.ts
//
// Tests for the public and private route definitions.
//
// Tested:
// - Home, the auth pages (including check-email and verify-email) and the Better Auth API are public
// - Anything else is private, including /account and /tasks
// - Auth pages are recognized as auth pages, other public routes are not
// - A trailing slash does not change the answer
// - accountPath builds /account?tab= hrefs
// - parseAccountTab defaults to profile and falls back for unknown values
// - projectCardPath builds /projects/:id?card= hrefs
// - projectArchivedPath builds /projects/:id/archived
// - parseProjectCardId returns a bounded id or null
//
// What is covered:
// - Happy path, the private default, edge cases (trailing slash, a path that
//   only looks like a public prefix), account tab hrefs, tab query fallback
//
// Run with: pnpm test:run tests/lib/routes.test.ts
//
// SEE: src/lib/routes.ts

import { describe, it, expect } from 'vitest';

import {
  accountPath,
  isAccountTab,
  isAuthPath,
  isPublicPath,
  parseAccountTab,
  parseProjectCardId,
  projectArchivedPath,
  projectCardPath,
} from '@/lib/routes';

describe('isPublicPath', () => {
  it('accepts home and the auth pages', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/sign-in')).toBe(true);
    expect(isPublicPath('/sign-up')).toBe(true);
    expect(isPublicPath('/forgot-password')).toBe(true);
    expect(isPublicPath('/reset-password')).toBe(true);
    expect(isPublicPath('/check-email')).toBe(true);
    expect(isPublicPath('/verify-email')).toBe(true);
  });

  it('accepts the Better Auth endpoints below /api/auth', () => {
    expect(isPublicPath('/api/auth')).toBe(true);
    expect(isPublicPath('/api/auth/sign-in/email')).toBe(true);
    expect(isPublicPath('/api/auth/get-session')).toBe(true);
  });

  it('rejects a route that is not listed', () => {
    expect(isPublicPath('/projects')).toBe(false);
    expect(isPublicPath('/projects/1')).toBe(false);
    expect(isPublicPath('/tasks')).toBe(false);
    expect(isPublicPath('/account')).toBe(false);
    expect(isPublicPath('/archived')).toBe(false);
    expect(isPublicPath('/api/projects')).toBe(false);
  });

  it('rejects a route that only starts with a public prefix', () => {
    expect(isPublicPath('/api/authorize')).toBe(false);
    expect(isPublicPath('/sign-in-later')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isPublicPath('/sign-in/')).toBe(true);
    expect(isPublicPath('/projects/')).toBe(false);
  });
});

describe('accountPath', () => {
  it('builds the account screen tab hrefs', () => {
    expect(accountPath('profile')).toBe('/account?tab=profile');
    expect(accountPath('visibility')).toBe('/account?tab=visibility');
    expect(accountPath('activity')).toBe('/account?tab=activity');
  });
});

describe('parseAccountTab', () => {
  it('returns the tab when the value is one of the three tabs', () => {
    expect(parseAccountTab('profile')).toBe('profile');
    expect(parseAccountTab('visibility')).toBe('visibility');
    expect(parseAccountTab('activity')).toBe('activity');
  });

  it('falls back to profile when the value is missing or unknown', () => {
    expect(parseAccountTab(undefined)).toBe('profile');
    expect(parseAccountTab('perfil')).toBe('profile');
    expect(parseAccountTab('cards')).toBe('profile');
    expect(parseAccountTab(['nope'])).toBe('profile');
    expect(parseAccountTab(['activity', 'cards'])).toBe('activity');
  });
});

describe('isAccountTab', () => {
  it('accepts only the three exact tab strings', () => {
    expect(isAccountTab('profile')).toBe(true);
    expect(isAccountTab('visibility')).toBe(true);
    expect(isAccountTab('activity')).toBe(true);
    expect(isAccountTab('cards')).toBe(false);
    expect(isAccountTab('perfil')).toBe(false);
    expect(isAccountTab(undefined)).toBe(false);
    expect(isAccountTab(['profile'])).toBe(false);
  });
});

describe('projectCardPath', () => {
  it('builds a project href with a card query', () => {
    expect(projectCardPath('proj-1', 'card-9')).toBe('/projects/proj-1?card=card-9');
  });
});

describe('projectArchivedPath', () => {
  it('builds the archived tasks href for a project', () => {
    expect(projectArchivedPath('proj-1')).toBe('/projects/proj-1/archived');
  });
});

describe('parseProjectCardId', () => {
  it('returns a trimmed id and ignores missing or oversized values', () => {
    expect(parseProjectCardId('card-9')).toBe('card-9');
    expect(parseProjectCardId(['card-9'])).toBe('card-9');
    expect(parseProjectCardId('  card-9  ')).toBe('card-9');
    expect(parseProjectCardId(undefined)).toBeNull();
    expect(parseProjectCardId('')).toBeNull();
    expect(parseProjectCardId('a'.repeat(129))).toBeNull();
  });
});

describe('isAuthPath', () => {
  it('accepts the sign in, sign up and password-reset pages', () => {
    expect(isAuthPath('/sign-in')).toBe(true);
    expect(isAuthPath('/sign-up')).toBe(true);
    expect(isAuthPath('/sign-up/')).toBe(true);
    expect(isAuthPath('/forgot-password')).toBe(true);
    expect(isAuthPath('/reset-password')).toBe(true);
    expect(isAuthPath('/reset-password/')).toBe(true);
    expect(isAuthPath('/check-email')).toBe(true);
    expect(isAuthPath('/verify-email')).toBe(true);
  });

  it('rejects other routes, public ones included', () => {
    expect(isAuthPath('/')).toBe(false);
    expect(isAuthPath('/api/auth/sign-in/email')).toBe(false);
    expect(isAuthPath('/projects')).toBe(false);
  });
});
