import type { Metadata } from 'next';

import SignUpForm from '@/components/auth/SignUpForm';

export const metadata: Metadata = {
  title: 'Sign up | wrapit',
  description: 'Create a wrapit account',
};

export default function SignUpPage() {
  return <SignUpForm />;
}
