import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import ProjectsMobileSearch from '@/components/projects/ProjectsMobileSearch';
import ProjectsShell from '@/components/projects/ProjectsShell';
import ProjectsView from '@/components/projects/ProjectsView';
import { auth } from '@/lib/auth';
import { initials } from '@/lib/initials';
import { filterRecentProjects } from '@/lib/projectGrid';
import { listProjectSummariesForUser, listRecentProjectsForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';
import { getUserPreferences } from '@/lib/userPreferences';

function sessionUsername(user: { username?: unknown }): string {
  return typeof user.username === 'string' ? user.username : '';
}

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  const [projects, preferences, recents] = await Promise.all([
    listProjectSummariesForUser(session.user.id),
    getUserPreferences(session.user.id),
    listRecentProjectsForUser(session.user.id),
  ]);
  // Recents are already access-filtered and capped in the query; this maps ids
  // to loaded summaries for chip rendering.
  const recentProjects = filterRecentProjects(recents, projects);
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
      <ProjectsView
        projects={projects}
        recentProjects={recentProjects}
        initialView={preferences.viewMode}
      />
    </ProjectsShell>
  );
}
