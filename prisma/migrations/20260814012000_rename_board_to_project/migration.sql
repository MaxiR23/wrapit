-- Rename Board to Project, preserving data.

ALTER TYPE "BoardStatus" RENAME TO "ProjectStatus";

ALTER TABLE "Board" RENAME TO "Project";
ALTER TABLE "Project" RENAME CONSTRAINT "Board_pkey" TO "Project_pkey";
ALTER TABLE "Project" RENAME CONSTRAINT "Board_ownerId_fkey" TO "Project_ownerId_fkey";

ALTER TABLE "Column" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "Column" RENAME CONSTRAINT "Column_boardId_fkey" TO "Column_projectId_fkey";

ALTER TABLE "Membership" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "Membership" RENAME CONSTRAINT "Membership_boardId_fkey" TO "Membership_projectId_fkey";
ALTER INDEX "Membership_userId_boardId_key" RENAME TO "Membership_userId_projectId_key";

ALTER TABLE "Invitation" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "Invitation" RENAME CONSTRAINT "Invitation_boardId_fkey" TO "Invitation_projectId_fkey";
ALTER INDEX "Invitation_boardId_inviteeId_key" RENAME TO "Invitation_projectId_inviteeId_key";
