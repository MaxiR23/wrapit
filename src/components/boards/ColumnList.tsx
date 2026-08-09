'use client';

import { useState, useTransition } from 'react';

import { deleteColumn } from '@/actions/deleteColumn';
import { Button } from '@/components/ui/button';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';

type ColumnListItem = {
  id: string;
  title: string;
};

export default function ColumnList({ columns }: { columns: ColumnListItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete(columnId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteColumn({ columnId });
      if ('error' in result) {
        setError(GENERIC_ERROR_MESSAGE);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {columns.map((column) => (
          <li
            key={column.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <span>{column.title}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              aria-label={`Delete column ${column.title}`}
              onClick={() => onDelete(column.id)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
