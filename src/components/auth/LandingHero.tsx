'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import BrandMark from '@/components/auth/BrandMark';
import MiniBoard from '@/components/auth/MiniBoard';
import { SIGN_IN_PATH } from '@/lib/routes';

const SCROLL_DELTA_THRESHOLD = 10;
const SWIPE_THRESHOLD = 40;

export default function LandingHero() {
  const router = useRouter();
  const advanced = useRef(false);

  useEffect(() => {
    function goToSignIn() {
      if (advanced.current) return;
      advanced.current = true;
      router.push(SIGN_IN_PATH);
    }

    function onWheel(event: WheelEvent) {
      if (event.deltaY <= SCROLL_DELTA_THRESHOLD) return;
      event.preventDefault();
      goToSignIn();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowDown' && event.key !== 'PageDown' && event.key !== ' ') return;
      event.preventDefault();
      goToSignIn();
    }

    let touchStartY: number | null = null;

    function onTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function onTouchEnd(event: TouchEvent) {
      if (touchStartY == null) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      if (touchStartY - endY > SWIPE_THRESHOLD) {
        goToSignIn();
      }
      touchStartY = null;
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [router]);

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

      <Link
        href={SIGN_IN_PATH}
        className="mt-brand flex min-h-11 flex-col items-center gap-1.5 self-center px-3.5 py-2 text-brand-cta"
      >
        <span className="text-[13px]">Sign in</span>
        <ChevronDown
          size={18}
          strokeWidth={1.7}
          className="animate-fadebob motion-reduce:animate-none"
        />
      </Link>
    </section>
  );
}
