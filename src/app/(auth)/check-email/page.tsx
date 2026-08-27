import type { Metadata } from 'next';

import CheckEmailPanel from '@/components/auth/CheckEmailPanel';

export const metadata: Metadata = {
  title: 'Check your email | wrapit',
  description: 'Verify your wrapit account from the link we sent',
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { email } = await searchParams;
  const emailValue = typeof email === 'string' ? email : undefined;

  return <CheckEmailPanel email={emailValue} />;
}
