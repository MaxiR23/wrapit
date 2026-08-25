'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { createComment } from '@/actions/createComment';
import type { BoardComment, BoardMember } from '@/components/projects/boardTypes';
import { shellFocusClassName } from '@/components/projects/shell';
import { initials } from '@/lib/initials';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { formatRelativeTime } from '@/lib/relativeTime';
import { cn } from '@/lib/utils';

export default function CardCommentThread({ comments }: { comments: BoardComment[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
        Comments
      </span>
      {comments.length === 0 ? (
        <span className="text-[13px] text-subtle">No comments yet</span>
      ) : (
        <div className="flex flex-col gap-3.5">
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="grid grid-cols-[30px_minmax(0,1fr)] gap-[11px] tablet:grid-cols-[28px_minmax(0,1fr)]"
            >
              <span
                title={comment.author.name}
                className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[10.5px] font-semibold tablet:size-7 tablet:text-[9.5px]"
              >
                {initials(comment.author.name, comment.author.username)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium">{comment.author.name}</span>
                  <span className="text-[11.5px] text-subtle">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-[13.5px] leading-[1.55] text-pretty text-muted-foreground">
                  {comment.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function CardCommentComposer({
  cardId,
  comments,
  currentUser,
  onChange,
}: {
  cardId: string;
  comments: BoardComment[];
  currentUser: BoardMember;
  onChange: (comments: BoardComment[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = draft.trim().length > 0 && !submitting;

  async function handleSubmit() {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await createComment({ cardId, body });
    setSubmitting(false);
    if ('fieldErrors' in result) {
      setError(result.fieldErrors.body ?? GENERIC_ERROR_MESSAGE);
      return;
    }
    if ('error' in result) {
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }
    setDraft('');
    onChange([...comments, result.data]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[9px] tablet:grid tablet:grid-cols-[28px_minmax(0,1fr)] tablet:gap-[11px]">
        <span
          title={currentUser.name}
          className="mb-0.5 hidden size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-[9.5px] font-semibold tablet:inline-flex"
        >
          {initials(currentUser.name, currentUser.username)}
        </span>
        <div className="flex min-w-0 flex-1 items-end gap-[9px] tablet:flex-col tablet:items-end tablet:gap-2">
          <textarea
            aria-label="Write a comment"
            rows={2}
            value={draft}
            placeholder="Write a comment"
            onChange={(event) => setDraft(event.target.value)}
            className={cn(
              shellFocusClassName,
              'min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-[1.4] tablet:w-full tablet:text-[13.5px] tablet:leading-[1.55]',
            )}
          />
          <button
            type="button"
            title="Comment"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className={cn(
              shellFocusClassName,
              'inline-flex size-[42px] shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-45',
              'tablet:h-8 tablet:w-auto tablet:px-3.5 tablet:text-[12.5px] tablet:font-semibold',
            )}
          >
            <ArrowRight className="size-[18px] tablet:hidden" strokeWidth={2} />
            <span className="hidden tablet:inline">Comment</span>
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
