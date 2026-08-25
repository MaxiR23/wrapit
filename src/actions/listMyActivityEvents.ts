'use server';

import { headers } from 'next/headers';

import {
  listActivityForActor,
  type AccountActivityEventListItem,
  type ActivityCursor,
  type ActorActivityListDb,
} from '@/lib/activity';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listMyActivityEventsSchema } from '@/lib/validation/activity';

type ListMyActivityEventsResult =
  | {
      data: {
        items: AccountActivityEventListItem[];
        nextCursor: ActivityCursor | null;
      };
    }
  | { error: string };

export async function listMyActivityEvents(
  input: { cursor?: ActivityCursor } = {},
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
  const projectIds = memberships.map((membership) => String(membership.projectId));

  const data = await listActivityForActor(prisma as unknown as ActorActivityListDb, {
    actorId: session.user.id,
    projectIds,
    cursor: parsed.data.cursor,
  });
  return { data };
}
