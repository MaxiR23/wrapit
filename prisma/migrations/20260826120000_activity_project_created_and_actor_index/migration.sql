-- AlterEnum
ALTER TYPE "ActivityEventType" ADD VALUE 'PROJECT_CREATED';

-- CreateIndex
CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "ActivityEvent"("actorId", "createdAt");
