-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "priority",
DROP COLUMN "labels",
ADD COLUMN "labelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Label_projectId_order_key" ON "Label"("projectId", "order");

-- CreateIndex
CREATE INDEX "Card_labelId_idx" ON "Card"("labelId");

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
