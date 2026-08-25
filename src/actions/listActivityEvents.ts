'use server';

import { headers } from 'next/headers';

import {
  listActivityForProject,
  type ActivityEventListItem,
  type ActivityListDb,
} from '@/lib/activity';
import { auth } from '@/lib/auth';
import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { listActivityEventsSchema } from '@/lib/validation/activity';

type ListActivityEventsResult =
  | {
      data: {
        items: ActivityEventListItem[];
        nextCursor: { createdAt: string; id: string } | null;
      };
    }
  | { error: string };

export async function listActivityEvents(input: {
  projectId: string;
  cursor?: { createdAt: string; id: string };
}): Promise<ListActivityEventsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = listActivityEventsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...accessibleByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  const data = await listActivityForProject(
    prisma as unknown as ActivityListDb,
    project.id,
    parsed.data.cursor,
  );
  return { data };
}
