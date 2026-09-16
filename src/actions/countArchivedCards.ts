'use server';

import { headers } from 'next/headers';

import { countArchivedCardsForUser } from '@/lib/archivedQuery';
import { auth } from '@/lib/auth';
import { countArchivedCardsSchema } from '@/lib/validation/archived';

type CountArchivedCardsResult =
  { data: { totalCount: number; excludeIds: string[] } } | { error: string };

export async function countArchivedCards(input: {
  projectId: string;
  query?: string;
  range?: 'all' | '7' | '30' | 'old';
  excludeIds?: string[];
}): Promise<CountArchivedCardsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = countArchivedCardsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const counted = await countArchivedCardsForUser(parsed.data.projectId, session.user.id, {
    query: parsed.data.query,
    range: parsed.data.range,
    excludeIds: parsed.data.excludeIds,
  });
  if (!counted) {
    return { error: 'Unauthorized' };
  }

  return {
    data: {
      totalCount: counted.totalCount,
      excludeIds: parsed.data.excludeIds ?? [],
    },
  };
}
