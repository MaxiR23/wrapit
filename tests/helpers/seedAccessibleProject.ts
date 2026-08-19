// tests/helpers/seedAccessibleProject.ts
//
// Seeds a Project plus a Membership so access checks that go through
// accessibleByUser succeed. ownerId remains creator metadata on the project.

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

type SeedDb = {
  project: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: string } & Record<string, unknown>>;
  };
  membership: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export async function seedAccessibleProject(
  db: SeedDb,
  data: {
    title: string;
    userId: string;
    ownerId?: string;
    role?: Role;
    starred?: boolean;
    status?: string;
    createdAt?: Date;
    description?: string | null;
  },
) {
  const ownerId = data.ownerId ?? data.userId;
  const project = await db.project.create({
    data: {
      title: data.title,
      ownerId,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
  await db.membership.create({
    data: {
      userId: data.userId,
      projectId: project.id,
      role: data.role ?? 'OWNER',
      starred: data.starred ?? false,
    },
  });
  return project;
}
