import type { Metadata } from 'next';

import VerifyEmailResult from '@/components/auth/VerifyEmailResult';

export const metadata: Metadata = {
  title: 'Verify email | wrapit',
  description: 'Email verification result for your wrapit account',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorValue = typeof error === 'string' ? error : undefined;

  return <VerifyEmailResult error={errorValue} />;
}
