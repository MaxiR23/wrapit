'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

import ServiceLinkText from '@/components/cards/ServiceLinkText';
import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

function isInsideLink(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('a'));
}

export default function EditableServiceText({
  value,
  ariaLabel,
  canEdit,
  rows,
  placeholder,
  className,
  displayClassName,
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

  if (canEdit && editing) {
    return (
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.currentTarget.blur();
        }}
        onBlur={() => {
          onBlur();
          setEditing(false);
        }}
        className={className}
      />
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
      {showPlaceholder ? placeholder : <ServiceLinkText text={value} />}
    </div>
  );
}
