import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import ProjectsMobileSearch from '@/components/projects/ProjectsMobileSearch';
import ProjectsShell from '@/components/projects/ProjectsShell';
import ProjectsView from '@/components/projects/ProjectsView';
import { auth } from '@/lib/auth';
import { initials } from '@/lib/initials';
import { listProjectSummariesForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const projects = await listProjectSummariesForUser(session.user.id);
  const username = sessionUsername(session.user);

  return (
    <ProjectsShell
      user={{
        name: session.user.name,
        username,
        initials: initials(session.user.name, username),
      }}
    >
      <ProjectsMobileSearch />
      <ProjectsView projects={projects} />
    </ProjectsShell>
  );
}
