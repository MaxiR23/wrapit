-- listProjectMembersForUser / board member identities by projectId.
-- @@unique([userId, projectId]) does not serve project-only lookups.
CREATE INDEX "Membership_members_by_project_idx" ON "Membership"("projectId");
