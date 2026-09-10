import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ArchivedView from '@/components/archived/ArchivedView';
import { listArchivedProjectsForUser } from '@/lib/archivedProjectsQuery';
import { SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Archived | wrapit',
};

export default async function ArchivedProjectsPage() {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const projects = await listArchivedProjectsForUser(session.user.id);

  return <ArchivedView initialProjects={projects} />;
}
