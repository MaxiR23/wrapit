import { ChevronDown } from 'lucide-react';

import BrandMark from '@/components/auth/BrandMark';
import MiniBoard from '@/components/auth/MiniBoard';
import { LANDING_HERO_CUE_ID } from '@/components/auth/mobileAuthBarOpacity';

export default function LandingHero() {
  return (
    <section className="brand-hero-surface flex min-h-dvh flex-col px-brand py-brand-block max-[360px]:px-5 max-[360px]:py-7">
      <BrandMark />

      <div className="flex flex-1 flex-col justify-center gap-4 py-[34px] max-[360px]:py-brand-block">
        <h1 className="text-[33px] leading-[1.12] font-semibold tracking-brand text-pretty max-[360px]:text-[30px] auth-sm:text-brand-headline auth-lg:text-brand-display">
          Your team&apos;s work, in columns.
        </h1>
        <p className="max-w-brand-lede text-brand-lede text-muted-foreground max-[360px]:text-[14.5px]">
          Shared projects, cards with an owner and a due date, and one view of what&apos;s in
          progress.
        </p>
      </div>

      <MiniBoard variant="hero" />

      <a
        id={LANDING_HERO_CUE_ID}
        href="#sign-in-form"
        className="mt-brand flex min-h-11 flex-col items-center gap-1.5 self-center px-3.5 py-2 text-brand-cta"
      >
        <span className="text-[13px]">Sign in</span>
        <ChevronDown
          size={18}
          strokeWidth={1.7}
          className="animate-fadebob motion-reduce:animate-none"
        />
      </a>
    </section>
  );
}
