-- Backfill an OWNER Membership for every Project.ownerId that is missing one.
-- Promote-then-insert so a creator who already has a non-OWNER row is not
-- duplicated (unique on userId + projectId). Safe to re-run: UPDATE matches
-- nothing once role is OWNER; INSERT skips rows that already exist.
--
-- IDs use gen_random_uuid() for portability in SQL. Runtime Membership ids
-- are cuid via Prisma @default(cuid()), so formats will mix on backfilled
-- rows. This is intentional and one-time.

UPDATE "Membership" AS m
SET "role" = 'OWNER'
FROM "Project" AS p
WHERE m."projectId" = p."id"
  AND m."userId" = p."ownerId"
  AND m."role" <> 'OWNER';

INSERT INTO "Membership" ("id", "role", "starred", "createdAt", "userId", "projectId")
SELECT gen_random_uuid()::text, 'OWNER', false, CURRENT_TIMESTAMP, p."ownerId", p."id"
FROM "Project" AS p
WHERE NOT EXISTS (
  SELECT 1 FROM "Membership" AS m
  WHERE m."projectId" = p."id" AND m."userId" = p."ownerId"
);
