'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { upsertOwnerMembershipStarred } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PROJECT_COLUMNS } from '@/lib/projects';
import { PROJECTS_PATH } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { projectSchema, type ProjectFieldErrors } from '@/lib/validation/project';

type CreateProjectResult =
  | {
      data: {
        id: string;
        title: string;
        description: string | null;
        status: string;
        ownerId: string;
        createdAt: Date;
      };
    }
  | { fieldErrors: ProjectFieldErrors }
  | { error: string };

export async function createProject(input: {
  title: string;
  description?: string;
  status?: 'NEW' | 'IN_PROGRESS' | 'PAUSED';
  featured?: boolean;
}): Promise<CreateProjectResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: firstErrorPerField(parsed.error) };
  }

  try {
    const description = parsed.data.description ? parsed.data.description : null;
    const status = parsed.data.status ?? 'NEW';

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          title: parsed.data.title,
          description,
          status,
          ownerId: session.user.id,
        },
      });

      for (const column of DEFAULT_PROJECT_COLUMNS) {
        await tx.column.create({
          data: {
            title: column.title,
            order: column.order,
            projectId: created.id,
          },
        });
      }

      if (parsed.data.featured) {
        await upsertOwnerMembershipStarred(tx, session.user.id, created.id, true);
      }

      return created;
    });

    revalidatePath(PROJECTS_PATH);

    return { data: project };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
