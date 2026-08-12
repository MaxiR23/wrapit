import type { Metadata } from 'next';

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot password | wrapit',
  description: 'Request a password reset for your wrapit account',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
