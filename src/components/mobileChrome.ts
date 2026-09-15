import { shellFocusClassName } from '@/components/projects/shell';
import { cn } from '@/lib/utils';

/** Every search field. type=search is banned; Safari cannot round that path. */
export const searchFieldDomProps = {
  type: 'text',
  role: 'searchbox',
  autoComplete: 'off',
  enterKeyHint: 'search',
} as const;

/** Add control: same box as the phone search field. */
export const mobileAddButtonClassName = cn(
  shellFocusClassName,
  'inline-flex size-mobile-search shrink-0 items-center justify-center rounded-md border border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
);
