'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { projectSchema, type ProjectFieldErrors } from '@/lib/validation/project';

type CreateProjectResult =
  | { data: { id: string; title: string; ownerId: string; createdAt: Date } }
  | { fieldErrors: ProjectFieldErrors }
  | { error: string };

export async function createProject(input: { title: string }): Promise<CreateProjectResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const project = await prisma.project.create({
      data: {
        title: parsed.data.title,
        ownerId: session.user.id,
      },
    });

    revalidatePath(PROJECTS_PATH);

    return { data: project };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
