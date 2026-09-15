-- Live board archivedAt IS NULL and archived-card lists by column.
CREATE INDEX "Card_live_and_archived_by_column_idx" ON "Card"("columnId", "archivedAt");
