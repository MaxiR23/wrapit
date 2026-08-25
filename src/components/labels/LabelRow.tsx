'use client';

import { X } from 'lucide-react';

import { updateLabelField } from '@/actions/updateLabelField';
import { deleteLabel } from '@/actions/deleteLabel';
import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';
import { shellFocusClassName } from '@/components/projects/shell';
import { labelToneClasses, nextLabelTone, parseLabelTone } from '@/lib/labelTones';
import type { LabelView } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function LabelRow({
  label,
  canDelete,
  onMetaChange,
  onDeleted,
}: {
  label: LabelView;
  canDelete: boolean;
  onMetaChange: (labelId: string, patch: { name?: string; tone?: LabelView['tone'] }) => void;
  onDeleted: (result: { id: string; replacementId: string }) => void;
}) {
  const name = useProfileAutosave({
    initial: label.name,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateLabelField({ labelId: label.id, field: 'name', value }),
    onSuccess: (value) => onMetaChange(label.id, { name: value }),
    onRevert: (value) => onMetaChange(label.id, { name: value }),
  });
  const tone = useProfileAutosave({
    initial: label.tone,
    debounceMs: 0,
    save: (value) => updateLabelField({ labelId: label.id, field: 'tone', value }),
    onSuccess: (value) => onMetaChange(label.id, { tone: value as LabelView['tone'] }),
    onRevert: (value) => onMetaChange(label.id, { tone: value as LabelView['tone'] }),
  });
  const currentTone = parseLabelTone(label.tone) ?? label.tone;
  const classes = labelToneClasses(currentTone);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="Change color"
        aria-label="Change color"
        className={cn(
          shellFocusClassName,
          'size-7 shrink-0 rounded-full border tablet:size-[22px]',
          classes.swatch,
        )}
        onClick={() => {
          const next = nextLabelTone(currentTone);
          tone.setValue(next);
          onMetaChange(label.id, { tone: next });
        }}
      />
      <input
        aria-label={`${label.name} name`}
        className={cn(
          shellFocusClassName,
          'h-[38px] min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 text-[13.5px] text-foreground tablet:h-8 tablet:text-[13px]',
        )}
        value={label.name}
        onChange={(event) => {
          const next = event.target.value;
          name.setValue(next);
          onMetaChange(label.id, { name: next });
        }}
        onBlur={() => void name.flush()}
      />
      <button
        type="button"
        title="Remove label"
        aria-label={`Remove ${label.name}`}
        disabled={!canDelete}
        className={cn(
          shellFocusClassName,
          'inline-flex size-[34px] shrink-0 items-center justify-center rounded-sm text-muted-foreground tablet:size-7',
          'hover:bg-danger-soft hover:text-danger',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
        onClick={() => {
          void deleteLabel({ labelId: label.id }).then((result) => {
            if ('data' in result) onDeleted(result.data);
          });
        }}
      >
        <X className="size-3.5" strokeWidth={1.7} />
      </button>
      {name.error || tone.error ? (
        <p role="alert" className="sr-only">
          {name.error ?? tone.error}
        </p>
      ) : null}
    </div>
  );
}
