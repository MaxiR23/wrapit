'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { accessibleByUser } from '@/lib/membership';
import { prisma } from '@/lib/prisma';
import { recordRecentProjectSchema } from '@/lib/validation/projectAccess';

export async function recordRecentProject(projectId: string): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return;
    }

    const parsed = recordRecentProjectSchema.safeParse({ projectId });
    if (!parsed.success) {
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, ...accessibleByUser(session.user.id) },
    });
    if (!project) {
      return;
    }

    const openedAt = new Date();
    await prisma.recentProject.upsert({
      where: {
        userId_projectId: { userId: session.user.id, projectId: parsed.data.projectId },
      },
      create: {
        userId: session.user.id,
        projectId: parsed.data.projectId,
        openedAt,
      },
      update: { openedAt },
    });
  } catch {
    // Opening a project must never fail navigation.
  }
}
