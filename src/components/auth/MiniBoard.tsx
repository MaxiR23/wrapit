import { cn } from '@/lib/utils';

type MiniBoardVariant = 'hero' | 'panel';

type MiniBoardProps = {
  variant: MiniBoardVariant;
};

type Column = {
  title: string;
  cards: number;
  emphasizeFirst: boolean;
  faded?: boolean;
};

const HERO_COLUMNS: Column[] = [
  { title: 'To do', cards: 3, emphasizeFirst: false },
  { title: 'In progress', cards: 2, emphasizeFirst: true },
  { title: 'Done', cards: 2, emphasizeFirst: false, faded: true },
];

const PANEL_COLUMNS: Column[] = [
  { title: 'To do', cards: 2, emphasizeFirst: false },
  { title: 'In progress', cards: 1, emphasizeFirst: true },
  { title: 'Done', cards: 1, emphasizeFirst: false },
];

export default function MiniBoard({ variant }: MiniBoardProps) {
  const columns = variant === 'hero' ? HERO_COLUMNS : PANEL_COLUMNS;
  const isHero = variant === 'hero';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid grid-cols-3',
        isHero ? 'gap-brand-tight max-[360px]:gap-2' : 'gap-3 auth-lg:gap-2.5',
      )}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={column.title}
          className={cn(
            'flex flex-col rounded-md border border-input',
            columnIndex === 1 ? 'mini-board-col-mid' : 'mini-board-col',
            isHero
              ? 'min-h-[207px] gap-2 p-2.5 max-[360px]:min-h-[190px] max-[360px]:gap-[7px] max-[360px]:p-brand-tight'
              : 'min-h-[132px] gap-brand-tight p-3 auth-lg:min-h-[120px] auth-lg:gap-2 auth-lg:p-2.5',
          )}
        >
          <span className={cn('text-foreground/60', isHero ? 'text-[10.5px]' : 'text-[11px]')}>
            {column.title}
          </span>
          {Array.from({ length: column.cards }, (_, cardIndex) => (
            <div
              key={cardIndex}
              className={cn(
                'rounded-sm',
                isHero ? 'h-brand-block max-[360px]:h-7' : 'h-brand-block auth-lg:h-7',
                column.emphasizeFirst && cardIndex === 0 ? 'bg-white/20' : 'bg-white/[0.08]',
                column.faded && 'opacity-70',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
