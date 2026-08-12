import type { Metadata } from 'next';

import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset password | wrapit',
  description: 'Set a new password for your wrapit account',
};

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token, error } = await searchParams;
  const tokenValue = typeof token === 'string' ? token : undefined;
  const errorValue = typeof error === 'string' ? error : undefined;

  return <ResetPasswordForm token={tokenValue} error={errorValue} />;
}
