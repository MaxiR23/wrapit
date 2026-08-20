-- CreateTable
CREATE TABLE "UserStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStatus_userId_order_key" ON "UserStatus"("userId", "order");

-- AddForeignKey
ALTER TABLE "UserStatus" ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeStatusId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_activeStatusId_key" ON "User"("activeStatusId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeStatusId_fkey" FOREIGN KEY ("activeStatusId") REFERENCES "UserStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
