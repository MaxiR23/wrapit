'use server';

import { headers } from 'next/headers';

import { getArchivedProjectDetailForUser } from '@/lib/archivedProjectsQuery';
import { auth } from '@/lib/auth';
import { archiveProjectSchema } from '@/lib/validation/archived';

type GetArchivedProjectDetailResult = { data: { description: string | null } } | { error: string };

export async function getArchivedProjectDetail(input: {
  projectId: string;
}): Promise<GetArchivedProjectDetailResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = archiveProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const detail = await getArchivedProjectDetailForUser(parsed.data.projectId, session.user.id);
  if (!detail) {
    return { error: 'Unauthorized' };
  }

  return { data: detail };
}
