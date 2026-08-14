'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '@/lib/authClient';
import { SIGN_IN_PATH } from '@/lib/routes';

const SIGN_OUT_ERROR_MESSAGE = 'Could not sign out. Please try again.';

/** Temporary sign-out used by the projects shell until the account menu exists. */
export function useSignOut() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
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

  return { signOut, error, isSigningOut };
}
