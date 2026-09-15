export type CountedComment = unknown;

export type CountedSubtask = { done: boolean };

/** Comment count for a card face and the detail thread. */
export function commentCount(comments: CountedComment[]): number {
  return comments.length;
}

/** Done / total for the detail bar and the board card footer. */
export function subtaskProgress(subtasks: CountedSubtask[]): { done: number; total: number } {
  let done = 0;
  for (const subtask of subtasks) {
    if (subtask.done) done += 1;
  }
  return { done, total: subtasks.length };
}

/** Footer comment count: the loaded thread wins over the first-paint number. */
export function faceCommentCount(card: {
  comments?: CountedComment[];
  commentCount?: number;
}): number {
  if (card.comments !== undefined) return commentCount(card.comments);
  return card.commentCount ?? 0;
}

/** Footer subtask progress: the loaded list wins over first-paint aggregates. */
export function faceSubtaskProgress(card: {
  subtasks?: CountedSubtask[];
  subtaskDone?: number;
  subtaskTotal?: number;
}): { done: number; total: number } {
  if (card.subtasks !== undefined) return subtaskProgress(card.subtasks);
  return { done: card.subtaskDone ?? 0, total: card.subtaskTotal ?? 0 };
}
