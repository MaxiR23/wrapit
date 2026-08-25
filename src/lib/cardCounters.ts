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
