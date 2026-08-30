'use client';

import { type RefObject } from 'react';
import { Bold, Code, Italic, Link, List, SquareCode } from 'lucide-react';

import { applyMarkdown, type MarkdownAction } from '@/lib/markdownToolbar';
import { cn } from '@/lib/utils';
import { shellFocusClassName } from '@/components/projects/shell';

const INLINE_ACTIONS: Array<{
  action: MarkdownAction;
  label: string;
  shortcuts: string;
  Icon: typeof Bold;
}> = [
  { action: 'bold', label: 'Bold', shortcuts: 'Control+B Meta+B', Icon: Bold },
  { action: 'italic', label: 'Italic', shortcuts: 'Control+I Meta+I', Icon: Italic },
  { action: 'code', label: 'Inline code', shortcuts: 'Control+E Meta+E', Icon: Code },
  { action: 'link', label: 'Link', shortcuts: 'Control+K Meta+K', Icon: Link },
];

const BLOCK_ACTIONS: Array<{
  action: MarkdownAction;
  label: string;
  shortcuts: string;
  Icon: typeof Bold;
}> = [
  {
    action: 'codeBlock',
    label: 'Code block',
    shortcuts: 'Control+Shift+C Meta+Shift+C',
    Icon: SquareCode,
  },
  { action: 'list', label: 'List', shortcuts: 'Control+Shift+L Meta+Shift+L', Icon: List },
];

export function markdownHotkey(
  event: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  variant: 'inline' | 'full',
): MarkdownAction | null {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();
  if (key === 'b' && !event.shiftKey) return 'bold';
  if (key === 'i' && !event.shiftKey) return 'italic';
  if (key === 'e' && !event.shiftKey) return 'code';
  if (key === 'k' && !event.shiftKey) return 'link';
  if (variant === 'full' && key === 'c' && event.shiftKey) return 'codeBlock';
  if (variant === 'full' && key === 'l' && event.shiftKey) return 'list';
  return null;
}

export function applyMarkdownToField(
  field: HTMLTextAreaElement | HTMLInputElement,
  value: string,
  action: MarkdownAction,
  onChange: (value: string) => void,
): void {
  const next = applyMarkdown(
    {
      value,
      selectionStart: field.selectionStart ?? 0,
      selectionEnd: field.selectionEnd ?? 0,
    },
    action,
  );
  onChange(next.value);
  requestAnimationFrame(() => {
    field.focus();
    field.setSelectionRange(next.selectionStart, next.selectionEnd);
  });
}

export default function MarkdownToolbar({
  variant,
  fieldRef,
  value,
  onChange,
}: {
  variant: 'inline' | 'full';
  fieldRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  const actions = variant === 'full' ? [...INLINE_ACTIONS, ...BLOCK_ACTIONS] : INLINE_ACTIONS;

  function handleAction(action: MarkdownAction) {
    const field = fieldRef.current;
    if (!field) return;
    applyMarkdownToField(field, value, action, onChange);
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5">
      {actions.map(({ action, label, shortcuts, Icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          aria-keyshortcuts={shortcuts}
          title={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleAction(action)}
          className={cn(
            shellFocusClassName,
            'inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-card hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-3.5" strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
