-- AlterTable
-- A null editedAt means the comment has never been edited, which is true of
-- every existing row.
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);
