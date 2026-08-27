-- AlterEnum
ALTER TYPE "ActivityEventType" ADD VALUE 'PROJECT_ARCHIVED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PROJECT_RESTORED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PROJECT_DELETED';

-- CreateEnum
CREATE TYPE "RestoreUndoKind" AS ENUM ('CARDS', 'PROJECT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "Project_archivedById_idx" ON "Project"("archivedById");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "RestoreUndoToken" ADD COLUMN "kind" "RestoreUndoKind" NOT NULL DEFAULT 'CARDS';
