import ProjectCard from '@/components/projects/ProjectCard';
import type { OnToggleStar } from '@/components/projects/ProjectStarButton';
import type { ProjectSummary } from '@/lib/projectGrid';

export default function ProjectGrid({
  projects,
  onToggle,
}: {
  projects: ProjectSummary[];
  onToggle?: OnToggleStar;
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(1,minmax(0,1fr))] gap-3.5 p-0 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
      {projects.map((project) => (
        <li key={project.id} className="min-w-0">
          <ProjectCard project={project} onToggle={onToggle} />
        </li>
      ))}
    </ul>
  );
}
