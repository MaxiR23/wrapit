-- CreateTable
CREATE TABLE "RecentProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentProject_userId_openedAt_idx" ON "RecentProject"("userId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentProject_userId_projectId_key" ON "RecentProject"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "RecentProject" ADD CONSTRAINT "RecentProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentProject" ADD CONSTRAINT "RecentProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
