'use server';

import { headers } from 'next/headers';

import { getArchivedCardsDetailForUser } from '@/lib/archivedQuery';
import { auth } from '@/lib/auth';
import type { CardDetail } from '@/lib/cardDetail';
import { archivedCardsDetailSchema } from '@/lib/validation/archived';

type ArchivedCardDetail = CardDetail & { commentCount: number };

type GetArchivedCardsDetailResult =
  { data: Record<string, ArchivedCardDetail> } | { error: string };

export async function getArchivedCardsDetail(input: {
  projectId: string;
  cardIds: string[];
}): Promise<GetArchivedCardsDetailResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = archivedCardsDetailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const details = await getArchivedCardsDetailForUser(
    parsed.data.projectId,
    parsed.data.cardIds,
    session.user.id,
  );
  if (!details) {
    return { error: 'Unauthorized' };
  }

  return { data: details };
}
