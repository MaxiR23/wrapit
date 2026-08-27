-- AlterEnum
ALTER TYPE "ActivityEventType" ADD VALUE 'CARD_RESTORED';

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "Card_archivedById_idx" ON "Card"("archivedById");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
