import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ColumnsEmptyState from '@/components/projects/ColumnsEmptyState';
import ProjectBoard from '@/components/projects/ProjectBoard';
import type { BoardCardData } from '@/components/projects/boardTypes';
import RecordRecentProject from '@/components/projects/RecordRecentProject';
import ProjectsShell from '@/components/projects/ProjectsShell';
import { auth } from '@/lib/auth';
import { cardLabelFromRow, type LabelView } from '@/lib/labels';
import { getNotificationsForUser } from '@/lib/notifications';
import { getProjectLabelsForUser } from '@/lib/projectLabels';
import { getProjectForUser, listProjectMembersForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

function asCard(
  card: {
    id: string;
    title: string;
    code: string;
    dueDate: Date | null;
    labelId?: string | null;
    assignees?: Array<{ id: string; name: string; username: string }>;
  },
  labels: LabelView[],
): BoardCardData {
  const row = card.labelId ? labels.find((label) => label.id === card.labelId) : undefined;
  return {
    id: card.id,
    title: card.title,
    code: card.code,
    dueDate: card.dueDate,
    label: cardLabelFromRow(row),
    assignees: card.assignees ?? [],
  };
}

export const metadata: Metadata = {
  title: 'Project | wrapit',
};

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

  const [members, notifications, labels] = await Promise.all([
    listProjectMembersForUser(project.id, session.user.id),
    getNotificationsForUser(session.user.id),
    getProjectLabelsForUser(project.id, session.user.id),
  ]);
  const username = sessionUsername(session.user);
  const projectLabels = labels ?? [];

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
      }}
      initialNotifications={notifications.items}
      activeNav="projects"
      showSearch={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <RecordRecentProject projectId={project.id} />
      {project.columns.length === 0 ? (
        <div className="px-4 py-6 md:px-7">
          <h1 className="text-[23px] font-semibold tracking-[-0.025em]">{project.title}</h1>
          <ColumnsEmptyState />
        </div>
      ) : (
        <ProjectBoard
          title={project.title}
          projectId={project.id}
          labels={projectLabels}
          members={(members ?? []).map((member) => ({
            id: member.userId,
            name: member.name,
            username: member.username,
          }))}
          columns={project.columns.map((column) => ({
            id: column.id,
            title: column.title,
            order: column.order,
            cards: column.cards.map((card) => asCard(card, projectLabels)),
          }))}
        />
      )}
    </ProjectsShell>
  );
}
