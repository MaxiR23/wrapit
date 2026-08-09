import { prisma } from '@/lib/prisma';

/** Boards owned by the given user, newest first. */
export function listBoardsForUser(ownerId: string) {
  return prisma.board.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}
