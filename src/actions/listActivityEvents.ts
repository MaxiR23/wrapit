'use server';

import { headers } from 'next/headers';

import {
  listActivityForProject,
  type ActivityEventListItem,
  type ActivityListDb,
} from '@/lib/activity';
import { auth } from '@/lib/auth';
import { accessibleByUser } from '@/lib/membership';
import { InvalidPageCursorError, type PageResult } from '@/lib/pagination';
import { prisma } from '@/lib/prisma';
import { listActivityEventsSchema } from '@/lib/validation/activity';

type ListActivityEventsResult =
  | {
      data: PageResult<ActivityEventListItem>;
    }
  | { error: string };

export async function listActivityEvents(input: {
  projectId: string;
  cursor?: string;
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

  try {
    const data = await listActivityForProject(
      prisma as unknown as ActivityListDb,
      project.id,
      parsed.data.cursor,
    );
    return { data };
  } catch (error) {
    if (error instanceof InvalidPageCursorError) return { error: 'Unauthorized' };
    throw error;
  }
}
