-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVITATION_RECEIVED', 'INVITATION_ACCEPTED', 'INVITATION_REJECTED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "invitationId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::"NotificationType");

-- CreateIndex
CREATE INDEX "Notification_invitationId_idx" ON "Notification"("invitationId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
