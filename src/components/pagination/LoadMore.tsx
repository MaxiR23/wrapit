'use client';

import { useRef, useState } from 'react';

export default function LoadMore({
  hasMore,
  nextCursor,
  onLoadMore,
  label = 'Load more',
  className,
}: {
  hasMore: boolean;
  nextCursor: string | null;
  onLoadMore: (cursor: string) => void | Promise<void>;
  label?: string;
  className?: string;
}) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  if (!hasMore || nextCursor == null) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setPending(true);
        void Promise.resolve(onLoadMore(nextCursor)).finally(() => {
          pendingRef.current = false;
          setPending(false);
        });
      }}
      className={className}
    >
      {label}
    </button>
  );
}
