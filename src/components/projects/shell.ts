import { cn } from '@/lib/utils';

export const shellFocusClassName =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export type ProjectsShellUser = {
  name: string;
  username: string;
  initials: string;
};

export type ShellPanelWidth = '236px' | '352px';

const PANEL_WIDTH_CLASS: Record<ShellPanelWidth, string> = {
  '236px': 'w-[236px]',
  '352px': 'w-[352px]',
};

/** Shared popover/sheet chrome for notifications and the account menu. */
export function shellPanelClassName(kind: 'popover' | 'sheet', width: ShellPanelWidth = '352px') {
  if (kind === 'popover') {
    return cn(
      'hidden md:block',
      'absolute top-[calc(100%+8px)] right-0 z-50',
      PANEL_WIDTH_CLASS[width],
      'overflow-hidden rounded-[12px] border border-border-strong bg-surface',
      'shadow-[0_30px_70px_oklch(0_0_0/0.6)]',
    );
  }

  return cn('md:hidden', 'fixed inset-0 z-50 flex flex-col bg-surface');
}
