import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { BOARDS_PATH, SIGN_IN_PATH } from '@/lib/routes';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  redirect(session ? BOARDS_PATH : SIGN_IN_PATH);
}
