-- AlterTable
ALTER TABLE "Project" ADD COLUMN "cardCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "code" TEXT;

-- Backfill stored codes from the project title at migration time.
-- Existing codes stay put after this; later title edits must not rewrite them.
UPDATE "Card" AS card
SET "code" = prefix.prefix || '-' || ranked.seq::text
FROM (
  SELECT
    c.id,
    p.title,
    row_number() OVER (
      PARTITION BY p.id
      ORDER BY c."createdAt" ASC, c.id ASC
    ) AS seq
  FROM "Card" c
  JOIN "Column" col ON col.id = c."columnId"
  JOIN "Project" p ON p.id = col."projectId"
) AS ranked
JOIN LATERAL (
  SELECT
    CASE
      WHEN length(trim(ranked.title)) = 0 THEN 'PR'
      WHEN array_length(regexp_split_to_array(trim(ranked.title), '\s+'), 1) >= 2 THEN
        upper(
          left((regexp_split_to_array(trim(ranked.title), '\s+'))[1], 1)
          || left(
            (regexp_split_to_array(trim(ranked.title), '\s+'))[
              array_length(regexp_split_to_array(trim(ranked.title), '\s+'), 1)
            ],
            1
          )
        )
      ELSE upper(left(trim(ranked.title), 2))
    END AS prefix
) AS prefix ON true
WHERE card.id = ranked.id;

UPDATE "Project" AS project
SET "cardCounter" = COALESCE((
  SELECT COUNT(*)::int
  FROM "Card" c
  JOIN "Column" col ON col.id = c."columnId"
  WHERE col."projectId" = project.id
), 0);

ALTER TABLE "Card" ALTER COLUMN "code" SET NOT NULL;
