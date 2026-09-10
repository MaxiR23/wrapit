import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import AccountScreen from '@/components/account/AccountScreen';
import { getAccountActivityForUser } from '@/lib/accountActivity';
import { prisma } from '@/lib/prisma';
import { accountPath, isAccountTab, parseAccountTab, SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { getUserProfileForUser } from '@/lib/userProfile';
import { getUserStatusesForUser } from '@/lib/userStatuses';

export const metadata: Metadata = {
  title: 'Account | wrapit',
  description: 'Your wrapit profile',
};

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { tab: rawTab } = await searchParams;
  const tab = parseAccountTab(rawTab);
  if (rawTab !== undefined && !isAccountTab(rawTab)) {
    redirect(accountPath('profile'));
  }

  const [profile, statuses, activity] = await Promise.all([
    getUserProfileForUser(session.user.id),
    getUserStatusesForUser(session.user.id),
    tab === 'activity'
      ? getAccountActivityForUser(prisma, session.user.id)
      : Promise.resolve(undefined),
  ]);

  if (!profile || !statuses) {
    redirect(SIGN_IN_PATH);
  }

  return <AccountScreen tab={tab} profile={profile} statuses={statuses} activity={activity} />;
}
