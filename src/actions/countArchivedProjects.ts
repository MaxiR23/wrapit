'use server';

import { headers } from 'next/headers';

import { countArchivedProjectsForUser } from '@/lib/archivedProjectsQuery';
import { auth } from '@/lib/auth';
import { countArchivedProjectsSchema } from '@/lib/validation/archived';

type CountArchivedProjectsResult =
  { data: { totalCount: number; excludeIds: string[] } } | { error: string };

export async function countArchivedProjects(
  input: {
    query?: string;
    range?: 'all' | '7' | '30' | 'old';
    excludeIds?: string[];
  } = {},
): Promise<CountArchivedProjectsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = countArchivedProjectsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const counted = await countArchivedProjectsForUser(session.user.id, parsed.data);
  return {
    data: {
      totalCount: counted.totalCount,
      excludeIds: parsed.data.excludeIds ?? [],
    },
  };
}
