'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { getCardDetailForUser, type CardDetail } from '@/lib/cardDetail';
import { getCardDetailSchema } from '@/lib/validation/card';

type GetCardDetailResult = { data: CardDetail } | { error: string };

export async function getCardDetail(input: { cardId: string }): Promise<GetCardDetailResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = getCardDetailSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const detail = await getCardDetailForUser(parsed.data.cardId, session.user.id);
  if (!detail) {
    return { error: 'Unauthorized' };
  }

  return { data: detail };
}
