'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { accessibleByUser } from '@/lib/membership';
import { GENERIC_ERROR_MESSAGE } from '@/lib/messages';
import { prisma } from '@/lib/prisma';
import { projectPath } from '@/lib/routes';
import { firstErrorPerField } from '@/lib/validation/fieldErrors';
import { createColumnSchema, type ColumnFieldErrors } from '@/lib/validation/column';

type CreateColumnResult =
  | { data: { id: string; title: string; order: number; projectId: string } }
  | { fieldErrors: ColumnFieldErrors }
  | { error: string };

export async function createColumn(input: {
  projectId: string;
  title: string;
}): Promise<CreateColumnResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) {
    const fieldFailed = parsed.error.issues.some((issue) => issue.path[0] === 'title');
    if (fieldFailed) {
      return { fieldErrors: firstErrorPerField(parsed.error) as ColumnFieldErrors };
    }
    return { error: 'Unauthorized' };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...accessibleByUser(session.user.id) },
  });
  if (!project) {
    return { error: 'Unauthorized' };
  }

  try {
    const [last] = await prisma.column.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'desc' },
      take: 1,
    });
    const order = (last?.order ?? 0) + 1;

    const column = await prisma.column.create({
      data: {
        title: parsed.data.title,
        order,
        projectId: project.id,
      },
    });

    revalidatePath(projectPath(project.id));

    return { data: column };
  } catch {
    // Never surface Prisma/raw messages: they can leak host or constraint details.
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
