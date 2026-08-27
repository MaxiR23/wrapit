-- Mark every existing account verified. These rows were created before
-- email verification existed; locking them out protects nothing. New
-- sign-ups keep emailVerified = false via the column default.
UPDATE "User" SET "emailVerified" = true;
