// tests/lib/routes.test.ts
//
// Tests for the public and private route definitions.
//
// Tested:
// - Home, the auth pages and the Better Auth API are public
// - Anything else is private
// - Auth pages are recognized as auth pages, other public routes are not
// - A trailing slash does not change the answer
//
// What is covered:
// - Happy path, the private default, edge cases (trailing slash, a path that
//   only looks like a public prefix)
//
// Run with: pnpm test:run tests/lib/routes.test.ts
//
// SEE: src/lib/routes.ts

import { describe, it, expect } from 'vitest';

import { isAuthPath, isPublicPath } from '@/lib/routes';

describe('isPublicPath', () => {
  it('accepts home and the auth pages', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/sign-in')).toBe(true);
    expect(isPublicPath('/sign-up')).toBe(true);
  });

  it('accepts the Better Auth endpoints below /api/auth', () => {
    expect(isPublicPath('/api/auth')).toBe(true);
    expect(isPublicPath('/api/auth/sign-in/email')).toBe(true);
    expect(isPublicPath('/api/auth/get-session')).toBe(true);
  });

  it('rejects a route that is not listed', () => {
    expect(isPublicPath('/boards')).toBe(false);
    expect(isPublicPath('/boards/1')).toBe(false);
    expect(isPublicPath('/api/boards')).toBe(false);
  });

  it('rejects a route that only starts with a public prefix', () => {
    expect(isPublicPath('/api/authorize')).toBe(false);
    expect(isPublicPath('/sign-in-later')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isPublicPath('/sign-in/')).toBe(true);
    expect(isPublicPath('/boards/')).toBe(false);
  });
});

describe('isAuthPath', () => {
  it('accepts the sign in and sign up pages', () => {
    expect(isAuthPath('/sign-in')).toBe(true);
    expect(isAuthPath('/sign-up')).toBe(true);
    expect(isAuthPath('/sign-up/')).toBe(true);
  });

  it('rejects other routes, public ones included', () => {
    expect(isAuthPath('/')).toBe(false);
    expect(isAuthPath('/api/auth/sign-in/email')).toBe(false);
    expect(isAuthPath('/boards')).toBe(false);
  });
});
