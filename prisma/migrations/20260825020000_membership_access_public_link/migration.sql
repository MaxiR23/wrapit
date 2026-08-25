-- Board access (EDIT / COMMENT / VIEW) on Membership, independent of role.
-- Existing rows backfill to EDIT so current members keep full board rights.
-- OWNER and ADMIN are constrained to EDIT. Public-link flag is stored only;
-- serving a signed-out visitor is a later slice.

CREATE TYPE "Access" AS ENUM ('EDIT', 'COMMENT', 'VIEW');

ALTER TABLE "Membership" ADD COLUMN "access" "Access" NOT NULL DEFAULT 'EDIT';

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_privileged_edit"
CHECK (("role" NOT IN ('OWNER', 'ADMIN')) OR ("access" = 'EDIT'));

ALTER TABLE "Project" ADD COLUMN "publicLinkEnabled" BOOLEAN NOT NULL DEFAULT false;
