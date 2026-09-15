import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ArchivedView from '@/components/archived/ArchivedView';
import { getArchivedCardsForUser } from '@/lib/archivedQuery';
import { getArchivedProjectForUser } from '@/lib/projects';
import { ARCHIVED_PATH, SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Archived | wrapit',
};

export default async function ProjectArchivedPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { projectId } = await params;
  const archived = await getArchivedCardsForUser(projectId, session.user.id);
  if (!archived) {
    const archivedProject = await getArchivedProjectForUser(projectId, session.user.id);
    if (archivedProject) {
      redirect(ARCHIVED_PATH);
    }
    notFound();
  }

  return (
    <ArchivedView
      projectId={archived.id}
      projectTitle={archived.title}
      initialCards={archived.cards}
      initialTotalCount={archived.totalCount}
      canAdminister={archived.canAdminister}
    />
  );
}
