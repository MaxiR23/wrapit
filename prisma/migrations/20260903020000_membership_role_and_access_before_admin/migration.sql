-- Nullable previous board access, restored when an ADMIN is demoted to MEMBER.
-- Existing rows stay NULL: a demotion with nothing stored lands on EDIT.
-- Membership_privileged_edit is unchanged.

ALTER TABLE "Membership" ADD COLUMN "accessBeforeAdmin" "Access";

ALTER TYPE "ActivityEventType" ADD VALUE 'MEMBER_PROMOTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'MEMBER_DEMOTED';
