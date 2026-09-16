'use server';

import { headers } from 'next/headers';

import {
  listArchivedProjectsForUser,
  type ArchivedProjectsPage,
} from '@/lib/archivedProjectsQuery';
import { auth } from '@/lib/auth';
import { InvalidPageCursorError } from '@/lib/pagination';
import { listArchivedProjectsSchema } from '@/lib/validation/archived';

type ListArchivedProjectsResult = { data: ArchivedProjectsPage } | { error: string };

export async function listArchivedProjects(
  input: {
    query?: string;
    range?: 'all' | '7' | '30' | 'old';
    sort?: 'date' | 'name';
    cursor?: string;
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

  try {
    const data = await listArchivedProjectsForUser(session.user.id, parsed.data);
    return { data };
  } catch (error) {
    if (error instanceof InvalidPageCursorError) {
      return { error: 'Unauthorized' };
    }
    throw error;
  }
}
