'use client';

import { useEffect, useRef, useState } from 'react';
import { Tag, X } from 'lucide-react';

import LabelEditor from '@/components/labels/LabelEditor';
import { useOpenPanel } from '@/components/projects/OpenPanel';
import { shellFocusClassName, shellPanelClassName } from '@/components/projects/shell';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

function LabelsPanel({
  projectId,
  labels,
  kind,
  onLabelsChange,
  onClose,
}: {
  projectId: string;
  labels: LabelView[];
  kind: 'popover' | 'sheet';
  onLabelsChange?: (labels: LabelView[]) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal={kind === 'sheet' ? true : undefined}
      aria-label="Labels"
      className={shellPanelClassName(kind)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="mr-auto text-[15px] font-semibold tracking-[-0.01em]">Labels</h2>
          {kind === 'sheet' ? (
            <button
              type="button"
              aria-label="Close"
              className={cn(
                shellFocusClassName,
                'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground',
              )}
              onClick={onClose}
            >
              <X className="size-4" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <LabelEditor
            projectId={projectId}
            labels={labels}
            onLabelsChange={onLabelsChange}
            onDone={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export default function LabelsControl({
  projectId,
  labels,
  onLabelsChange,
}: {
  projectId: string;
  labels: LabelView[];
  onLabelsChange?: (labels: LabelView[]) => void;
}) {
  const { openPanel, setOpenPanel } = useOpenPanel();
  const open = openPanel === 'labels';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedByThis = useRef(false);
  const [draft, setDraft] = useState<LabelView[] | null>(null);
  if (!open && draft !== null) {
    setDraft(null);
  }
  const workingLabels = draft ?? labels;

  useEffect(() => {
    if (openPanel === 'labels') {
      openedByThis.current = document.activeElement === triggerRef.current;
      return;
    }
    if (!openedByThis.current) return;
    openedByThis.current = false;
    if (openPanel === null) {
      triggerRef.current?.focus();
    }
  }, [openPanel]);

  function handleLabelsChange(next: LabelView[]) {
    setDraft(next);
    onLabelsChange?.(next);
  }

  function close() {
    setOpenPanel(null);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Labels"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpenPanel(open ? null : 'labels')}
        className={cn(
          shellFocusClassName,
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px]',
          open ? 'text-foreground' : 'text-subtle hover:text-foreground',
        )}
      >
        <Tag className="size-[15px]" strokeWidth={2} />
        Labels
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40 hidden md:block" aria-hidden="true" onClick={close} />
          <LabelsPanel
            projectId={projectId}
            labels={workingLabels}
            kind="popover"
            onLabelsChange={handleLabelsChange}
            onClose={close}
          />
          <LabelsPanel
            projectId={projectId}
            labels={workingLabels}
            kind="sheet"
            onLabelsChange={handleLabelsChange}
            onClose={close}
          />
        </>
      ) : null}
    </div>
  );
}
