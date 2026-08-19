'use client';

import { useState } from 'react';
import { ChevronLeft, Grid2x2Plus } from 'lucide-react';

import EmptyDemoBoard from '@/components/projects/EmptyDemoBoard';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import ProjectTemplateRow from '@/components/projects/ProjectTemplateRow';
import { shellFocusClassName } from '@/components/projects/shell';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { listProjectTemplates, type ProjectTemplateId } from '@/lib/templates';
import { cn } from '@/lib/utils';

const subtitle = 'Pick a starting point. You can change the columns later, anytime.';

function createLabel(name: string | undefined) {
  return name ? `Create with ${name}` : 'Create my first project';
}

export default function ProjectsEmptyState() {
  const templates = listProjectTemplates();
  const [selectedId, setSelectedId] = useState<ProjectTemplateId | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selected = templates.find((template) => template.id === selectedId);
  const ctaLabel = createLabel(selected?.name);

  return (
    <>
      <div className="flex flex-col gap-[18px]">
        <div
          className={cn(
            'flex flex-col items-center rounded-[14px] border border-dashed border-border-strong text-center',
            'gap-3.5 px-[22px] pt-9 pb-[30px]',
            'md:gap-[15px] md:px-8 md:py-10',
            'lg:px-10 lg:py-[52px]',
          )}
        >
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-[12px] border border-border-strong text-muted-foreground',
              'size-12 md:size-[52px] lg:size-[54px]',
            )}
          >
            <Grid2x2Plus className="size-[22px] md:size-6 lg:size-[25px]" strokeWidth={1.5} />
          </span>
          <div className="flex max-w-[420px] flex-col gap-1.5 md:max-w-[380px] lg:max-w-[420px]">
            <h2 className="text-[16.5px] font-semibold text-foreground md:text-[17px] lg:text-[18px] lg:tracking-[-0.015em]">
              No projects yet
            </h2>
            <p className="text-[13.5px] leading-[1.55] text-pretty text-muted-foreground">
              {subtitle}
            </p>
          </div>

          <div
            className={cn(
              'mt-0.5 hidden w-full grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid md:max-w-[560px]',
              'lg:max-w-[820px] lg:grid-cols-[repeat(3,minmax(0,1fr))]',
            )}
          >
            {templates.map((template) => (
              <ProjectTemplateRow
                key={template.id}
                template={template}
                selected={selectedId === template.id}
                onSelect={() => setSelectedId(template.id)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              shellFocusClassName,
              'mt-1 h-12 w-full rounded-md bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90',
              'md:inline-flex md:h-[42px] md:w-auto md:items-center md:justify-center md:px-5 md:text-sm',
              'lg:h-[38px] lg:px-[18px] lg:text-[13.5px]',
            )}
          >
            {ctaLabel}
          </button>
          <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  shellFocusClassName,
                  'h-10 text-[13.5px] font-medium text-muted-foreground hover:text-foreground md:hidden',
                )}
              >
                View templates
              </button>
            </DialogTrigger>
            <DialogContent
              showCloseButton={false}
              aria-modal="true"
              overlayClassName="z-[70] bg-background md:hidden"
              className="fixed inset-0 top-0 left-0 z-[70] flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 text-foreground shadow-none sm:max-w-none md:hidden"
            >
              <DialogHeader className="h-14 shrink-0 flex-row items-center gap-1.5 border-b border-border bg-surface p-0 pr-2.5 pl-1.5">
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label="Back"
                    className={cn(
                      shellFocusClassName,
                      'inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ChevronLeft className="size-5" strokeWidth={1.6} />
                  </button>
                </DialogClose>
                <DialogTitle className="mr-auto text-base font-semibold tracking-[-0.01em] text-foreground">
                  Templates
                </DialogTitle>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pt-[18px] pb-5">
                <div className="flex flex-col gap-1.5">
                  <p className="text-[19px] font-semibold tracking-[-0.01em] text-foreground">
                    Pick a starting point
                  </p>
                  <DialogDescription className="text-[13.5px] leading-[1.55] text-pretty text-muted-foreground">
                    You can change the columns later, anytime.
                  </DialogDescription>
                </div>
                <div className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <ProjectTemplateRow
                      key={template.id}
                      template={template}
                      selected={selectedId === template.id}
                      onSelect={() => setSelectedId(template.id)}
                      layout="stack"
                    />
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col border-t border-border bg-surface px-4 py-3">
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className={cn(
                    shellFocusClassName,
                    'h-12 shrink-0 rounded-md bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {ctaLabel}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <EmptyDemoBoard />
      </div>

      <NewProjectDialog
        templateId={selectedId ?? 'blank'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
