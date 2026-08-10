import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import BoardKanban from '@/components/boards/BoardKanban';
import ColumnsEmptyState from '@/components/boards/ColumnsEmptyState';
import NewColumnDialog from '@/components/boards/NewColumnDialog';
import { auth } from '@/lib/auth';
import { getBoardForUser } from '@/lib/boards';
import { SIGN_IN_PATH } from '@/lib/routes';

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const { boardId } = await params;
  const board = await getBoardForUser(boardId, session.user.id);
  if (!board) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{board.title}</h1>
        <NewColumnDialog boardId={board.id} />
      </div>

      {board.columns.length === 0 ? (
        <ColumnsEmptyState />
      ) : (
        <BoardKanban
          columns={board.columns.map((column) => ({
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
