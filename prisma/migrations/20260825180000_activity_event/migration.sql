-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM (
    'CARD_CREATED',
    'CARD_MOVED',
    'CARD_ARCHIVED',
    'CARD_DELETED',
    'ASSIGNEES_CHANGED',
    'LABEL_CHANGED',
    'DUE_DATE_CHANGED',
    'COMMENT_ADDED',
    'MEMBER_ADDED',
    'MEMBER_REMOVED'
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_projectId_createdAt_idx" ON "ActivityEvent"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
