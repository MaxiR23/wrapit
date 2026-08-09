import Link from 'next/link';

import { boardPath } from '@/lib/routes';

type BoardListItem = {
  id: string;
  title: string;
};

export default function BoardList({ boards }: { boards: BoardListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {boards.map((board) => (
        <li key={board.id}>
          <Link
            href={boardPath(board.id)}
            className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
          >
            {board.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
