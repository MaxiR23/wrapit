import BrandMark from '@/components/auth/BrandMark';
import MiniBoard from '@/components/auth/MiniBoard';

export default function BrandPanel() {
  return (
    <aside className="brand-panel-surface hidden flex-col gap-6 p-11 pb-10 auth-sm:flex auth-sm:flex-none auth-lg:w-[44%] auth-lg:min-w-[380px] auth-lg:justify-between auth-lg:gap-0 auth-lg:border-r auth-lg:border-border auth-lg:p-11">
      <BrandMark />

      <div className="flex flex-col gap-3">
        <h1 className="max-w-[24ch] text-brand-headline leading-[1.1] font-semibold tracking-brand text-pretty auth-lg:max-w-none auth-lg:text-brand-display">
          Your team&apos;s work, in columns.
        </h1>
        <p className="max-w-[52ch] text-brand-lede text-muted-foreground auth-lg:max-w-brand-lede">
          Shared boards, cards with an owner and a due date, and one view of what&apos;s in
          progress.
        </p>
      </div>

      <MiniBoard variant="panel" />
    </aside>
  );
}
