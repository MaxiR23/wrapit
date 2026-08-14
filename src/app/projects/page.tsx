import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import NewProjectDialog from '@/components/projects/NewProjectDialog';
import ProjectList from '@/components/projects/ProjectList';
import ProjectsEmptyState from '@/components/projects/ProjectsEmptyState';
import { auth } from '@/lib/auth';
import { listProjectsForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const projects = await listProjectsForUser(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? <ProjectsEmptyState /> : <ProjectList projects={projects} />}
    </main>
  );
}
