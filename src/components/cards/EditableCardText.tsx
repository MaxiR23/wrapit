'use client';

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import CardMarkdown from '@/components/cards/CardMarkdown';
import MarkdownToolbar, {
  applyMarkdownToField,
  markdownHotkey,
} from '@/components/cards/MarkdownToolbar';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

function isInsideLink(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('a'));
}

export default function EditableCardText({
  value,
  ariaLabel,
  canEdit,
  rows,
  placeholder,
  className,
  displayClassName,
  variant = 'full',
  editing: editingProp,
  onEditingChange,
  activateOnDisplay = true,
  saveOnBlur = true,
  saveDisabled = false,
  onChange,
  onBlur,
  onSave,
  onCancel,
}: {
  value: string;
  ariaLabel: string;
  canEdit: boolean;
  rows: number;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  variant?: 'inline' | 'full';
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  activateOnDisplay?: boolean;
  saveOnBlur?: boolean;
  saveDisabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  const [uncontrolledEditing, setUncontrolledEditing] = useState(false);
  const isControlled = editingProp !== undefined;
  const editing = isControlled ? editingProp : uncontrolledEditing;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function setEditing(next: boolean) {
    if (!isControlled) setUncontrolledEditing(next);
    onEditingChange?.(next);
  }

  useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
    const node = textareaRef.current;
    if (!node) return;
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }, [editing]);

  function startEditing() {
    if (!canEdit || !activateOnDisplay) return;
    setEditing(true);
  }

  function handleDisplayClick(event: MouseEvent<HTMLElement>) {
    if (isInsideLink(event.target)) return;
    startEditing();
  }

  function handleDisplayKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isInsideLink(event.target)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    startEditing();
  }

  function handleWrapperBlur(event: FocusEvent<HTMLElement>) {
    if (!saveOnBlur) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    onBlur?.();
    setEditing(false);
  }

  if (canEdit && editing) {
    return (
      <div className="flex flex-col gap-1.5" onBlur={saveOnBlur ? handleWrapperBlur : undefined}>
        <MarkdownToolbar
          variant={variant}
          fieldRef={textareaRef}
          value={value}
          onChange={onChange}
        />
        <textarea
          ref={textareaRef}
          aria-label={ariaLabel}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (saveOnBlur) {
                event.currentTarget.blur();
              } else {
                event.preventDefault();
                onCancel?.();
              }
              return;
            }
            const action = markdownHotkey(event, variant);
            if (!action) return;
            event.preventDefault();
            applyMarkdownToField(event.currentTarget, value, action, onChange);
          }}
          className={className}
        />
        {saveOnBlur ? null : (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className={cn(
                shellFocusClassName,
                'h-8 rounded-md px-3 text-[12.5px] font-semibold text-muted-foreground',
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => onSave?.()}
              className={cn(
                shellFocusClassName,
                'h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-45',
              )}
            >
              Save
            </button>
          </div>
        )}
      </div>
    );
  }

  const showPlaceholder = value === '' && Boolean(placeholder);
  const displayInteractive = canEdit && activateOnDisplay;

  return (
    <div
      tabIndex={displayInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={displayInteractive ? handleDisplayClick : undefined}
      onKeyDown={displayInteractive ? handleDisplayKeyDown : undefined}
      className={cn(
        displayInteractive && shellFocusClassName,
        displayClassName,
        showPlaceholder && 'text-muted-foreground',
      )}
    >
      {showPlaceholder ? placeholder : <CardMarkdown text={value} variant={variant} />}
    </div>
  );
}
