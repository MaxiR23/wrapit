import { Fragment, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { BookOpen, FileText, GitBranch, Hash, Layers, type LucideIcon } from 'lucide-react';

import { shellFocusClassName } from '@/components/projects/shell';
import { splitServiceLinks, type ServiceId } from '@/lib/serviceLinks';
import { cn } from '@/lib/utils';

const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  github: GitBranch,
  figma: Layers,
  notion: BookOpen,
  'google-docs': FileText,
  slack: Hash,
};

function stopCardHandlers(
  event:
    MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement> | DragEvent<HTMLAnchorElement>,
) {
  event.stopPropagation();
  if ('preventDefault' in event && event.type === 'dragstart') event.preventDefault();
}

export default function ServiceLinkText({ text, className }: { text: string; className?: string }) {
  const segments = splitServiceLinks(text);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Fragment key={index}>{segment.value}</Fragment>;
        }
        const Icon = SERVICE_ICONS[segment.service];
        return (
          <a
            key={`${segment.href}-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={stopCardHandlers}
            onPointerDown={stopCardHandlers}
            onDragStart={stopCardHandlers}
            className={cn(
              shellFocusClassName,
              'inline-flex max-w-full items-center gap-1 rounded-sm align-text-bottom text-inherit no-underline hover:underline',
              className,
            )}
          >
            <Icon aria-hidden className="size-[1em] shrink-0" strokeWidth={2} />
            {segment.label}
          </a>
        );
      })}
    </>
  );
}
