import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import ColumnsEmptyState from '@/components/projects/ColumnsEmptyState';
import NewColumnDialog from '@/components/projects/NewColumnDialog';
import ProjectKanban from '@/components/projects/ProjectKanban';
import ProjectMembersSection from '@/components/projects/ProjectMembersSection';
import RecordRecentProject from '@/components/projects/RecordRecentProject';
import { auth } from '@/lib/auth';
import { getProjectForUser, listProjectMembersForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { projectId } = await params;
  const project = await getProjectForUser(projectId, session.user.id);
  if (!project) {
    notFound();
  }

  const members = await listProjectMembersForUser(project.id, session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <RecordRecentProject projectId={project.id} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <NewColumnDialog projectId={project.id} />
      </div>

      {members ? <ProjectMembersSection projectId={project.id} members={members} /> : null}

      {project.columns.length === 0 ? (
        <ColumnsEmptyState />
      ) : (
        <ProjectKanban
          columns={project.columns.map((column) => ({
            id: column.id,
            title: column.title,
            cards: column.cards.map((card) => ({
              id: card.id,
              title: card.title,
              description: card.description,
            })),
          }))}
        />
      )}
    </main>
  );
}
