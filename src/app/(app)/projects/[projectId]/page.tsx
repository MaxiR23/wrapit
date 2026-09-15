import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import ProjectBoard from '@/components/projects/ProjectBoard';
import type { BoardCardData } from '@/components/projects/boardTypes';
import RecordRecentProject from '@/components/projects/RecordRecentProject';
import { cardLabelFromRow, type LabelView } from '@/lib/labels';
import type { BoardAccess } from '@/lib/membership';
import { getArchivedProjectForUser, getBoardPageForUser } from '@/lib/projects';
import { ARCHIVED_PATH, parseProjectCardId, SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

function asCard(
  card: {
    id: string;
    title: string;
    code: string;
    dueDate: Date | null;
    dueTimeZone?: string | null;
    labelId?: string | null;
    assignees?: Array<{ id: string; name: string; username: string }>;
    commentCount?: number;
    subtaskDone?: number;
    subtaskTotal?: number;
  },
  labels: LabelView[],
): BoardCardData {
  const row = card.labelId ? labels.find((label) => label.id === card.labelId) : undefined;
  return {
    id: card.id,
    title: card.title,
    code: card.code,
    dueDate: card.dueDate,
    dueTimeZone: card.dueTimeZone ?? null,
    label: cardLabelFromRow(row),
    assignees: card.assignees ?? [],
    commentCount: card.commentCount ?? 0,
    subtaskDone: card.subtaskDone ?? 0,
    subtaskTotal: card.subtaskTotal ?? 0,
  };
}

export const metadata: Metadata = {
  title: 'Project | wrapit',
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<'/projects/[projectId]'>) {
  const session = await getSession();
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const initialOpenCardId = parseProjectCardId(query.card);
  const board = await getBoardPageForUser(projectId, session.user.id);
  if (!board) {
    const archived = await getArchivedProjectForUser(projectId, session.user.id);
    if (archived) {
      redirect(ARCHIVED_PATH);
    }
    notFound();
  }

  const username = sessionUsername(session.user);
  const boardAccess: BoardAccess = board.viewer?.access ?? 'VIEW';
  const teamRole = board.viewer?.role ?? 'MEMBER';

  return (
    <>
      <RecordRecentProject projectId={board.id} />
      <ProjectBoard
        title={board.title}
        projectId={board.id}
        labels={board.labels}
        currentUser={{
          id: session.user.id,
          name: session.user.name,
          username,
        }}
        initialVisibility={board.boardVisibility}
        boardAccess={boardAccess}
        teamRole={teamRole}
        publicLinkEnabled={board.publicLinkEnabled}
        initialOpenCardId={initialOpenCardId}
        members={board.members}
        columns={board.columns.map((column) => ({
          id: column.id,
          title: column.title,
          order: column.order,
          cards: column.cards.map((card) => asCard(card, board.labels)),
        }))}
      />
    </>
  );
}
