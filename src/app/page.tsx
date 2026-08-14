import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import LandingHero from '@/components/auth/LandingHero';
import { auth } from '@/lib/auth';
import { PROJECTS_PATH } from '@/lib/routes';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect(PROJECTS_PATH);
  }

  return <LandingHero />;
}
