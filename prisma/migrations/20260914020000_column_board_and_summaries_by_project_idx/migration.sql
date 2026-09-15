-- Board, summaries, archived, and my-tasks columns by project ordered by order.
CREATE INDEX "Column_board_and_summaries_by_project_idx" ON "Column"("projectId", "order");
