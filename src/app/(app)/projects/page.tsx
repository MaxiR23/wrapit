import { redirect } from 'next/navigation';

import ProjectsMobileSearch from '@/components/projects/ProjectsMobileSearch';
import ProjectsView from '@/components/projects/ProjectsView';
import { filterRecentProjects } from '@/lib/projectGrid';
import { listProjectSummariesForUser, listRecentProjectsForUser } from '@/lib/projects';
import { SIGN_IN_PATH } from '@/lib/routes';
import { getSession } from '@/lib/session';
import { getUserPreferences } from '@/lib/userPreferences';

export default async function ProjectsPage() {
  const session = await getSession();
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

  return (
    <>
      <ProjectsMobileSearch />
      <ProjectsView
        projects={projects}
        recentProjects={recentProjects}
        initialView={preferences.viewMode}
      />
    </>
  );
}
