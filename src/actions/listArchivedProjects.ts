'use server';

import { headers } from 'next/headers';

import {
  listArchivedProjectsForUser,
  type ArchivedProjectsPage,
} from '@/lib/archivedProjectsQuery';
import { auth } from '@/lib/auth';
import { listArchivedProjectsSchema } from '@/lib/validation/archived';

type ListArchivedProjectsResult = { data: ArchivedProjectsPage } | { error: string };

export async function listArchivedProjects(
  input: {
    query?: string;
    range?: 'all' | '7' | '30' | 'old';
    sort?: 'date' | 'name';
    cursor?: { id: string; title: string; archivedAt: string };
  } = {},
): Promise<ListArchivedProjectsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = listArchivedProjectsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const data = await listArchivedProjectsForUser(session.user.id, parsed.data);
  return { data };
}
