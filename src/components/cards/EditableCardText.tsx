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
  onChange,
  onBlur,
}: {
  value: string;
  ariaLabel: string;
  canEdit: boolean;
  rows: number;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  variant?: 'inline' | 'full';
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
    const node = textareaRef.current;
    if (!node) return;
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }, [editing]);

  function startEditing() {
    if (!canEdit) return;
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
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    onBlur();
    setEditing(false);
  }

  if (canEdit && editing) {
    return (
      <div className="flex flex-col gap-1.5" onBlur={handleWrapperBlur}>
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
              return;
            }
            const action = markdownHotkey(event, variant);
            if (!action) return;
            event.preventDefault();
            applyMarkdownToField(event.currentTarget, value, action, onChange);
          }}
          className={className}
        />
      </div>
    );
  }

  const showPlaceholder = value === '' && Boolean(placeholder);

  return (
    <div
      tabIndex={canEdit ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={canEdit ? handleDisplayClick : undefined}
      onKeyDown={canEdit ? handleDisplayKeyDown : undefined}
      className={cn(
        canEdit && shellFocusClassName,
        displayClassName,
        showPlaceholder && 'text-muted-foreground',
      )}
    >
      {showPlaceholder ? placeholder : <CardMarkdown text={value} variant={variant} />}
    </div>
  );
}
