'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/authClient';
import { SIGN_IN_PATH, SIGN_UP_PATH } from '@/lib/routes';

const SIGN_OUT_ERROR_MESSAGE = 'Could not sign out. Please try again.';

const linkClasses = 'text-sm font-medium underline underline-offset-4';

export default function AuthNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);

    const { error: signOutError } = await authClient.signOut();

    if (signOutError) {
      // Never render signOutError.message: it can carry server internals.
      setError(SIGN_OUT_ERROR_MESSAGE);
      setIsSigningOut(false);
      return;
    }

    router.push(SIGN_IN_PATH);
    // Drops any cached render that was built for the session that just ended.
    router.refresh();
  }

  if (pathname === SIGN_IN_PATH || pathname === SIGN_UP_PATH) return null;

  // Render nothing until the session is known, so the nav does not flash the
  // signed out links at a signed in user.
  if (isPending) return <nav className="flex items-center justify-end gap-4 p-4" />;

  return (
    <nav className="flex items-center justify-end gap-4 p-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {session ? (
        <Button type="button" onClick={handleSignOut} disabled={isSigningOut} size="sm">
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </Button>
      ) : (
        <>
          <Link href={SIGN_IN_PATH} className={linkClasses}>
            Sign in
          </Link>
          <Link href={SIGN_UP_PATH} className={linkClasses}>
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
