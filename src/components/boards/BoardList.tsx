type BoardListItem = {
  id: string;
  title: string;
};

export default function BoardList({ boards }: { boards: BoardListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {boards.map((board) => (
        <li key={board.id} className="rounded-lg border border-border px-3 py-2 text-sm">
          {board.title}
        </li>
      ))}
    </ul>
  );
}
