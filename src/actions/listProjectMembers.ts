'use server';

import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { listProjectMembersForUser, type ProjectMember } from '@/lib/projects';
import { listProjectMembersSchema } from '@/lib/validation/projectAccess';

type ListProjectMembersResult = { data: { members: ProjectMember[] } } | { error: string };

export async function listProjectMembers(input: {
  projectId: string;
}): Promise<ListProjectMembersResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const parsed = listProjectMembersSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Unauthorized' };
  }

  const members = await listProjectMembersForUser(parsed.data.projectId, session.user.id);
  if (!members) {
    return { error: 'Unauthorized' };
  }

  return { data: { members } };
}
