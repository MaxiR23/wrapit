'use client';

import Link from 'next/link';
import { type KeyboardEvent } from 'react';

import { shellFocusClassName } from '@/components/projects/shell';
import { ACCOUNT_TABS, accountPath, type AccountTab } from '@/lib/routes';
import { cn } from '@/lib/utils';

const TAB_LABELS: Record<AccountTab, string> = {
  profile: 'Profile',
  visibility: 'Visibility',
  activity: 'Activity',
};

export default function AccountTabs({ tab }: { tab: AccountTab }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = ACCOUNT_TABS.indexOf(tab);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = ACCOUNT_TABS[(index + delta + ACCOUNT_TABS.length) % ACCOUNT_TABS.length];
    if (!next) return;
    const target = event.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`);
    target?.click();
    target?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Account"
      onKeyDown={onKeyDown}
      className="flex gap-[22px] border-b border-border"
    >
      {ACCOUNT_TABS.map((item) => {
        const selected = item === tab;
        return (
          <Link
            key={item}
            href={accountPath(item)}
            role="tab"
            data-tab={item}
            aria-selected={selected}
            aria-controls={`account-panel-${item}`}
            id={`account-tab-${item}`}
            scroll={false}
            className={cn(
              shellFocusClassName,
              'mb-[-1px] border-b-2 pb-3 text-[13.5px] no-underline',
              selected
                ? 'border-foreground font-semibold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABELS[item]}
          </Link>
        );
      })}
    </div>
  );
}
