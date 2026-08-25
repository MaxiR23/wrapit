'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { administeredByUser } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { updatePublicLinkSchema } from '@/lib/validation/membership';

type UpdatePublicLinkResult = { data: { enabled: boolean } } | { error: string };

export async function updatePublicLink(input: {
  projectId: string;
  enabled: boolean;
}): Promise<UpdatePublicLinkResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = updatePublicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const { projectId, enabled } = parsed.data;

  try {
    const updated = await prisma.project.updateMany({
      where: { id: projectId, ...administeredByUser(session.user.id) },
      data: { publicLinkEnabled: enabled },
    });
    if (updated.count !== 1) {
      return { error: 'Unauthorized' };
    }

    revalidatePath(projectPath(projectId));
    return { data: { enabled } };
  } catch {
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
