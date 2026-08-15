'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function recordRecentProject(projectId: string): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: session.user.id },
    });
    if (!project) {
      return;
    }

    const openedAt = new Date();
    await prisma.recentProject.upsert({
      where: {
        userId_projectId: { userId: session.user.id, projectId },
      },
      create: {
        userId: session.user.id,
        projectId,
        openedAt,
      },
      update: { openedAt },
    });
  } catch {
    // Opening a project must never fail navigation.
  }
}
