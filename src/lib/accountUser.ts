import { cache } from 'react';

import { prisma } from '@/lib/prisma';

/**
 * Request-scoped User row for the account screen. Profile and statuses share
 * this read; it does not survive to the next request.
 */
export const getAccountUser = cache(async function getAccountUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
});
