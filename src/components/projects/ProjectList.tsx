import Link from 'next/link';

import { projectPath } from '@/lib/routes';

type ProjectListItem = {
  id: string;
  title: string;
};

export default function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={projectPath(project.id)}
            className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
          >
            {project.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
