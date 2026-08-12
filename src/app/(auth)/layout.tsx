export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden lg:flex lg:w-[44%] flex-col justify-between border-r border-border bg-card p-11">
        <div className="flex items-center gap-2.5">
          <div className="size-[22px] rounded-sm bg-foreground" />
          <span className="text-base font-semibold tracking-tight">wrapit</span>
        </div>

        <div>
          <h1 className="text-[38px] leading-[1.1] font-semibold tracking-tight text-pretty">
            Your team&apos;s work, in columns.
          </h1>
          <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
            Shared boards, cards with an owner and a due date, and one view of what&apos;s in
            progress.
          </p>
        </div>

        <div aria-hidden="true" className="grid grid-cols-3 gap-2.5">
          <div className="flex min-h-[120px] flex-col gap-2 rounded-md border border-border p-2.5">
            <span className="text-[11px] text-muted-foreground">To do</span>
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
          </div>
          <div className="flex min-h-[120px] flex-col gap-2 rounded-md border border-border p-2.5">
            <span className="text-[11px] text-muted-foreground">In progress</span>
            <div className="h-7 rounded-[6px] bg-white/20" />
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
          </div>
          <div className="flex min-h-[120px] flex-col gap-2 rounded-md border border-border p-2.5">
            <span className="text-[11px] text-muted-foreground">Done</span>
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
            <div className="h-7 rounded-[6px] bg-white/[0.08]" />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 items-center justify-center p-11">
        <div className="w-full max-w-[330px]">{children}</div>
      </div>
    </div>
  );
}
