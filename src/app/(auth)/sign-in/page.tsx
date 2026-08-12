import type { Metadata } from 'next';

import SignInForm from '@/components/auth/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in | wrapit',
  description: 'Sign in to your wrapit account',
};

export default function SignInPage() {
  return <SignInForm />;
}
