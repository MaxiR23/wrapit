import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { PROJECTS_PATH, SIGN_IN_PATH } from '@/lib/routes';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect(PROJECTS_PATH);
  }

  redirect(SIGN_IN_PATH);
}
