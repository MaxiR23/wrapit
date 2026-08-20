-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('ANYONE', 'TEAM', 'ADMINS_ONLY');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "pronouns" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "organization" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "workingWithYou" TEXT NOT NULL DEFAULT '',
    "photoVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "fullNameVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "publicNameVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "pronounsVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "jobTitleVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "departmentVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "organizationVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "locationVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "localTimeVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "workingWithYouVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ANYONE',
    "emailVisibility" "ProfileVisibility" NOT NULL DEFAULT 'ADMINS_ONLY',

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
