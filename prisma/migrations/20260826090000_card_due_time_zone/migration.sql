-- AlterTable
-- A null zone means dueDate is a calendar day stored as UTC midnight, which is
-- what every existing row holds. A set zone makes dueDate a real instant.
ALTER TABLE "Card" ADD COLUMN "dueTimeZone" TEXT;
