// tests/proxy.test.ts
//
// Tests for the route protection proxy.
//
// Tested:
// - A private route without a session redirects to /sign-in
// - A public route is served without a session
// - /sign-in and /sign-up with a session redirect to home
// - A private route with a session is served
// - The Better Auth API is reachable in both states
//
// What is covered:
// - Both session states against public, private and auth routes
//
// Run with: pnpm test:run tests/proxy.test.ts
//
// SEE: proxy.ts, app/lib/routes.ts

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import proxy from '@/proxy';

const origin = 'http://localhost:3000';

/** The cookie Better Auth sets on sign in. The value is never validated here. */
const SESSION_COOKIE = 'better-auth.session_token=a-session-token';

function request(path: string, { signedIn = false } = {}) {
  return new NextRequest(`${origin}${path}`, {
    headers: signedIn ? { cookie: SESSION_COOKIE } : {},
  });
}

/** The path a response redirects to, or null when it does not redirect. */
function redirectTarget(response: Response): string | null {
  const location = response.headers.get('location');

  return location === null ? null : new URL(location).pathname;
}

describe('proxy without a session', () => {
  it('redirects a private route to the sign in page', () => {
    const response = proxy(request('/boards'));

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe('/sign-in');
  });

  it('serves a public route', () => {
    expect(redirectTarget(proxy(request('/')))).toBeNull();
  });

  it('serves the sign in and sign up pages', () => {
    expect(redirectTarget(proxy(request('/sign-in')))).toBeNull();
    expect(redirectTarget(proxy(request('/sign-up')))).toBeNull();
  });

  it('serves the Better Auth API, so signing in stays possible', () => {
    expect(redirectTarget(proxy(request('/api/auth/sign-in/email')))).toBeNull();
  });
});

describe('proxy with a session', () => {
  it('redirects the sign in page to home', () => {
    const response = proxy(request('/sign-in', { signedIn: true }));

    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe('/');
  });

  it('redirects the sign up page to home', () => {
    expect(redirectTarget(proxy(request('/sign-up', { signedIn: true })))).toBe('/');
  });

  it('serves a private route', () => {
    expect(redirectTarget(proxy(request('/boards', { signedIn: true })))).toBeNull();
  });

  it('serves the Better Auth API, so signing out stays possible', () => {
    expect(redirectTarget(proxy(request('/api/auth/sign-out', { signedIn: true })))).toBeNull();
  });
});
