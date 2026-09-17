'use server';

import { headers } from 'next/headers';

import {
  listActivityForActor,
  type AccountActivityEventListItem,
  type ActorActivityListDb,
} from '@/lib/activity';
import { auth } from '@/lib/auth';
import { InvalidPageCursorError, type PageResult } from '@/lib/pagination';
import { prisma } from '@/lib/prisma';
import { listMyActivityEventsSchema } from '@/lib/validation/activity';

type ListMyActivityEventsResult =
  | {
      data: PageResult<AccountActivityEventListItem>;
    }
  | { error: string };

export async function listMyActivityEvents(
  input: { cursor?: string } = {},
): Promise<ListMyActivityEventsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = listMyActivityEventsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
  });
  const membershipProjectIds = memberships.map((membership) => String(membership.projectId));
  const liveProjects =
    membershipProjectIds.length === 0
      ? []
      : await prisma.project.findMany({
          where: { id: { in: membershipProjectIds }, archivedAt: null },
        });
  const projectIds = liveProjects.map((project) => String(project.id));

  try {
    const data = await listActivityForActor(prisma as unknown as ActorActivityListDb, {
      actorId: session.user.id,
      projectIds,
      cursor: parsed.data.cursor,
    });
    return { data };
  } catch (error) {
    if (error instanceof InvalidPageCursorError) return { error: 'Unauthorized' };
    throw error;
  }
}
