'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { PROJECTS_PATH } from '@/lib/routes';
import { getTemplateColumns } from '@/lib/templates';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { projectSchema, type ProjectFieldErrors } from '@/lib/validation/project';

type CreateProjectColumn = { title: string; order: number };

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

function columnsToCreate(columns: CreateProjectColumn[] | undefined): CreateProjectColumn[] {
  if (!columns) {
    const titles = getTemplateColumns('blank');
    if (!titles) {
      throw new Error('Blank template is missing');
    }
    return titles.map((title, order) => ({ title, order }));
  }

  return [...columns]
    .sort((left, right) => left.order - right.order)
    .map((column, order) => ({ title: column.title, order }));
}

export async function createProject(input: {
  title: string;
  description?: string;
  status?: 'NEW' | 'IN_PROGRESS' | 'PAUSED';
  featured?: boolean;
  columns?: CreateProjectColumn[];
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
    const columns = columnsToCreate(parsed.data.columns);

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          title: parsed.data.title,
          description,
          status,
          ownerId: session.user.id,
        },
      });

      for (const column of columns) {
        await tx.column.create({
          data: {
            title: column.title,
            order: column.order,
            projectId: created.id,
          },
        });
      }

      await tx.membership.create({
        data: {
          userId: session.user.id,
          projectId: created.id,
          role: 'OWNER',
          starred: parsed.data.featured === true,
        },
      });

      return created;
    });

    revalidatePath(PROJECTS_PATH);

    return { data: project };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
