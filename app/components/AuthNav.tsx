'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { authClient } from '@/app/lib/authClient';

const SIGN_OUT_ERROR_MESSAGE = 'Could not sign out. Please try again.';

const linkClasses = 'text-sm font-medium underline underline-offset-4';

export default function AuthNav() {
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

    router.push('/sign-in');
    // Drops any cached render that was built for the session that just ended.
    router.refresh();
  }

  // Render nothing until the session is known, so the nav does not flash the
  // signed out links at a signed in user.
  if (isPending) return <nav className="flex items-center justify-end gap-4 p-4" />;

  return (
    <nav className="flex items-center justify-end gap-4 p-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {session ? (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      ) : (
        <>
          <Link href="/sign-in" className={linkClasses}>
            Sign in
          </Link>
          <Link href="/sign-up" className={linkClasses}>
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
