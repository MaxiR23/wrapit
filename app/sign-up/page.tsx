import type { Metadata } from 'next';

import SignUpForm from '@/app/components/SignUpForm';

export const metadata: Metadata = {
  title: 'Sign up | wrapit',
  description: 'Create a wrapit account',
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUpForm />
    </main>
  );
}
