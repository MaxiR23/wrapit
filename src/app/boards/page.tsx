import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import BoardList from '@/components/boards/BoardList';
import BoardsEmptyState from '@/components/boards/BoardsEmptyState';
import NewBoardDialog from '@/components/boards/NewBoardDialog';
import { auth } from '@/lib/auth';
import { listBoardsForUser } from '@/lib/boards';
import { SIGN_IN_PATH } from '@/lib/routes';

export default async function BoardsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const boards = await listBoardsForUser(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Boards</h1>
        <NewBoardDialog />
      </div>

      {boards.length === 0 ? <BoardsEmptyState /> : <BoardList boards={boards} />}
    </main>
  );
}
