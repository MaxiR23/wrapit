'use server';

import { headers } from 'next/headers';

import { getArchivedCardsForUser, type ArchivedCardsPage } from '@/lib/archivedQuery';
import { auth } from '@/lib/auth';
import { InvalidPageCursorError } from '@/lib/pagination';
import { listArchivedCardsSchema } from '@/lib/validation/archived';

type ListArchivedCardsResult = { data: ArchivedCardsPage } | { error: string };

export async function listArchivedCards(input: {
  projectId: string;
  query?: string;
  range?: 'all' | '7' | '30' | 'old';
  sort?: 'date' | 'name';
  cursor?: string;
  excludeIds?: string[];
}): Promise<ListArchivedCardsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = listArchivedCardsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  try {
    const page = await getArchivedCardsForUser(parsed.data.projectId, session.user.id, {
      query: parsed.data.query,
      range: parsed.data.range,
      sort: parsed.data.sort,
      cursor: parsed.data.cursor,
      excludeIds: parsed.data.excludeIds,
    });
    if (!page) {
      return { error: 'Unauthorized' };
    }

    return { data: page };
  } catch (error) {
    if (error instanceof InvalidPageCursorError) {
      return { error: 'Unauthorized' };
    }
    throw error;
  }
}
