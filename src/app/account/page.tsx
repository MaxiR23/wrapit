import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import AccountScreen from '@/components/account/AccountScreen';
import ProjectsShell from '@/components/projects/ProjectsShell';
import { auth } from '@/lib/auth';
import { getNotificationsForUser } from '@/lib/notifications';
import { accountPath, isAccountTab, parseAccountTab, SIGN_IN_PATH } from '@/lib/routes';
import { getUserProfileForUser } from '@/lib/userProfile';

export const metadata: Metadata = {
  title: 'Account | wrapit',
  description: 'Your wrapit profile',
};

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { tab: rawTab } = await searchParams;
  const tab = parseAccountTab(rawTab);
  if (rawTab !== undefined && !isAccountTab(rawTab)) {
    redirect(accountPath('profile'));
  }

  const [profile, notifications] = await Promise.all([
    getUserProfileForUser(session.user.id),
    getNotificationsForUser(session.user.id),
  ]);

  if (!profile) {
    redirect(SIGN_IN_PATH);
  }

  const username = sessionUsername(session.user);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
      }}
      initialNotifications={notifications.items}
      activeNav={null}
      showSearch={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <AccountScreen tab={tab} profile={profile} />
    </ProjectsShell>
  );
}
