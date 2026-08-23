'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { createLabel } from '@/actions/createLabel';
import LabelRow from '@/components/labels/LabelRow';
import { shellFocusClassName } from '@/components/projects/shell';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function LabelEditor({
  projectId,
  labels,
  onLabelsChange,
  onDone,
}: {
  projectId: string;
  labels: LabelView[];
  onLabelsChange?: (labels: LabelView[]) => void;
  onDone: () => void;
}) {
  const [addError, setAddError] = useState<string | null>(null);
  const labelsRef = useRef(labels);
  const canDelete = labels.length > 1;

  useLayoutEffect(() => {
    labelsRef.current = labels;
  });

  function commit(next: LabelView[]) {
    labelsRef.current = next;
    onLabelsChange?.(next);
  }

  function patchMeta(labelId: string, patch: { name?: string; tone?: LabelView['tone'] }) {
    commit(
      labelsRef.current.map((label) => (label.id === labelId ? { ...label, ...patch } : label)),
    );
  }

  function handleDeleted(result: { id: string; replacementId: string }) {
    commit(labelsRef.current.filter((label) => label.id !== result.id));
  }

  async function handleAdd() {
    setAddError(null);
    const result = await createLabel({ projectId });
    if ('error' in result) {
      setAddError(result.error);
      return;
    }
    if ('fieldErrors' in result) {
      setAddError(result.fieldErrors.projectId ?? 'Something went wrong. Please try again.');
      return;
    }
    commit([...labelsRef.current, result.data]);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-[13px]">
      <p className="text-[11.5px] text-subtle">Edit the name, click the color to change it</p>
      <div className="flex flex-col gap-2">
        {labels.map((label) => (
          <LabelRow
            key={label.id}
            label={label}
            canDelete={canDelete}
            onMetaChange={patchMeta}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-[9px]">
        <button
          type="button"
          className={cn(
            shellFocusClassName,
            'inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-[12.5px] font-medium',
          )}
          onClick={() => void handleAdd()}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New label
        </button>
        <button
          type="button"
          className={cn(
            shellFocusClassName,
            'ml-auto h-9 px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground',
          )}
          onClick={onDone}
        >
          Done
        </button>
      </div>
      {addError ? (
        <p role="alert" className="text-xs text-destructive">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
