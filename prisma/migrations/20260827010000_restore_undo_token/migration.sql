-- CreateTable
CREATE TABLE "RestoreUndoToken" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cards" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "RestoreUndoToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestoreUndoToken_expiresAt_idx" ON "RestoreUndoToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RestoreUndoToken_userId_idx" ON "RestoreUndoToken"("userId");

-- AddForeignKey
ALTER TABLE "RestoreUndoToken" ADD CONSTRAINT "RestoreUndoToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreUndoToken" ADD CONSTRAINT "RestoreUndoToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
