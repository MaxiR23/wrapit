'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { useVisibilityMenu } from '@/components/account/VisibilityMenuProvider';
import { shellFocusClassName } from '@/components/projects/shell';
import type { ProfileVisibility } from '@/lib/userProfile';
import { cn } from '@/lib/utils';

export const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string }[] = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'team', label: 'Team only' },
  { value: 'admins', label: 'You and admins only' },
];

export function visibilityLabel(value: ProfileVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? 'Anyone';
}

export default function VisibilityDropdown({
  menuKey,
  label,
  value,
  onChange,
}: {
  menuKey: string;
  label: string;
  value: ProfileVisibility;
  onChange: (value: ProfileVisibility) => void;
}) {
  const { openKey, setOpenKey } = useVisibilityMenu();
  const open = openKey === menuKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpenKey(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenKey(null);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const items = VISIBILITY_OPTIONS.map((option) =>
        document.getElementById(`${labelId}-${option.value}`),
      );
      const index = items.findIndex((item) => item === document.activeElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const from = index === -1 ? (delta > 0 ? -1 : items.length) : index;
      const next = items[(from + delta + items.length) % items.length];
      next?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpenKey, labelId]);

  function toggle() {
    setOpenKey(open ? null : menuKey);
  }

  function pick(next: ProfileVisibility) {
    onChange(next);
    setOpenKey(null);
    triggerRef.current?.focus();
  }

  return (
    <span className="relative inline-flex justify-self-end">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} visibility: ${visibilityLabel(value)}`}
        onClick={toggle}
        className={cn(
          shellFocusClassName,
          'inline-flex h-8 items-center gap-[7px] rounded-sm border bg-transparent px-[11px] text-[12.5px]',
          'text-muted-foreground hover:border-border-strong hover:text-foreground',
          open ? 'border-border-strong' : 'border-border',
        )}
      >
        {visibilityLabel(value)}
        <ChevronDown className="size-3" strokeWidth={2} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Visibility"
          className={cn(
            'absolute top-[calc(100%+6px)] right-0 z-[60] flex w-[248px] flex-col gap-px p-[5px]',
            'rounded-[10px] border border-border-strong bg-surface',
            'shadow-[0_18px_44px_oklch(0_0_0/0.55)]',
          )}
        >
          {VISIBILITY_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                id={`${labelId}-${option.value}`}
                type="button"
                role="menuitem"
                onClick={() => pick(option.value)}
                className={cn(
                  shellFocusClassName,
                  'flex items-center gap-[9px] rounded-[6px] px-[9px] py-2 text-left text-[12.5px]',
                  selected
                    ? 'bg-card text-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-card',
                )}
              >
                <span className="inline-flex w-3 shrink-0 items-center justify-center text-foreground">
                  {selected ? <Check className="size-2.5" strokeWidth={2.5} /> : null}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}
