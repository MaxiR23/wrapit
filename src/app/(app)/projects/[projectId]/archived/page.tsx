import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ArchivedView from '@/components/archived/ArchivedView';
import { getArchivedCardsForUser } from '@/lib/archivedQuery';
import { canAdministerProject, type MembershipRole } from '@/lib/boardAccess';
import { getArchivedProjectForUser, listProjectMembersForUser } from '@/lib/projects';
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

  const members = await listProjectMembersForUser(archived.id, session.user.id);
  const memberList = members ?? [];
  const viewer = memberList.find((member) => member.userId === session.user.id);
  const teamRole: MembershipRole = viewer?.role ?? 'MEMBER';

  return (
    <ArchivedView
      projectId={archived.id}
      projectTitle={archived.title}
      initialCards={archived.cards}
      canAdminister={canAdministerProject(teamRole)}
    />
  );
}
