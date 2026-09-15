'use server';

import { headers } from 'next/headers';

import { getArchivedCardDetailForUser } from '@/lib/archivedQuery';
import { auth } from '@/lib/auth';
import { archivedCardDetailSchema } from '@/lib/validation/archived';

type GetArchivedCardDetailResult =
  | {
      data: {
        description: string | null;
        subtasks: Array<{ id: string; text: string; done: boolean; order: number }>;
        comments: Array<{
          id: string;
          body: string;
          createdAt: Date;
          editedAt: Date | null;
          author: { id: string; name: string; username: string };
        }>;
        commentCount: number;
      };
    }
  | { error: string };

export async function getArchivedCardDetail(input: {
  cardId: string;
}): Promise<GetArchivedCardDetailResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = archivedCardDetailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const detail = await getArchivedCardDetailForUser(parsed.data.cardId, session.user.id);
  if (!detail) {
    return { error: 'Unauthorized' };
  }

  return { data: detail };
}
