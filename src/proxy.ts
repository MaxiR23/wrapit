import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

import { PROJECTS_PATH, SIGN_IN_PATH, isAuthPath, isPublicPath } from '@/lib/routes';

/**
 * Route protection.
 *
 * The check is optimistic: it only looks for the session cookie and never
 * validates it against the database, so it stays cheap enough to run on every
 * request. A forged or expired cookie gets past it; whatever the request
 * reaches must still read the real session with `auth.api.getSession`.
 *
 * Next 16 calls this file convention "proxy"; it was named "middleware" before.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = getSessionCookie(request) !== null;

  if (hasSession) {
    // A signed in user has nothing to do on the sign in or sign up page.
    return isAuthPath(pathname)
      ? NextResponse.redirect(new URL(PROJECTS_PATH, request.url))
      : NextResponse.next();
  }

  return isPublicPath(pathname)
    ? NextResponse.next()
    : NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
}

export const config = {
  // Everything except Next internals and static files. Auth pages are matched
  // on purpose: a signed in user visiting them gets redirected away.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
