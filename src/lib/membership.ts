type MembershipClient = {
  membership: {
    upsert: (args: {
      where: { userId_projectId: { userId: string; projectId: string } };
      update: { starred: boolean };
      create: {
        userId: string;
        projectId: string;
        role: 'OWNER';
        starred: boolean;
      };
    }) => Promise<unknown>;
  };
};

/** Create or update the owner's membership row with the given starred value. */
export async function upsertOwnerMembershipStarred(
  db: MembershipClient,
  userId: string,
  projectId: string,
  starred: boolean,
) {
  await db.membership.upsert({
    where: {
      userId_projectId: { userId, projectId },
    },
    update: { starred },
    create: {
      userId,
      projectId,
      role: 'OWNER',
      starred,
    },
  });
}
