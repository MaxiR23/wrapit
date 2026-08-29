'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

import BrandMark from '@/components/auth/BrandMark';
import { easeDocumentScrollTo } from '@/components/auth/easeDocumentScroll';
import {
  LANDING_HERO_CUE_ID,
  MOBILE_AUTH_BAR_FADE_DISTANCE_PX,
  mobileAuthBarOpacity,
} from '@/components/auth/mobileAuthBarOpacity';
import { HOME_PATH } from '@/lib/routes';

const backClassName =
  'ml-auto -mr-2 inline-flex size-11 items-center justify-center text-brand-icon hover:text-foreground';

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia?.(REDUCE_MOTION);
  if (!mql) {
    return () => {};
  }

  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function reducedMotionMatches() {
  return window.matchMedia?.(REDUCE_MOTION).matches ?? false;
}

function reducedMotionServer() {
  return false;
}

export default function MobileAuthBar({ href = HOME_PATH }: { href?: string }) {
  const coverId = href.startsWith('#') ? href.slice(1) : undefined;
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionMatches,
    reducedMotionServer,
  );
  const [opacity, setOpacity] = useState(coverId && !reducedMotion ? 0 : 1);
  const icon = <ChevronUp size={18} strokeWidth={1.7} />;

  useEffect(() => {
    if (!coverId) {
      return;
    }

    const update = () => {
      const cue = document.getElementById(LANDING_HERO_CUE_ID);
      setOpacity(mobileAuthBarOpacity(cue ? cue.getBoundingClientRect().top : null, reducedMotion));
    };

    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    const frame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [coverId, reducedMotion]);

  const unavailable = opacity === 0;

  function onHashBackClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!coverId) {
      return;
    }

    const target = document.getElementById(coverId);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.currentTarget.blur();
    easeDocumentScrollTo(target.getBoundingClientRect().top + window.scrollY, reducedMotion);
    history.pushState(null, '', href);
  }

  return (
    <header
      aria-hidden={unavailable || undefined}
      inert={unavailable || undefined}
      className="brand-bar-surface fixed inset-x-0 top-0 z-50 flex items-center gap-3 px-4 py-3.5 auth-sm:hidden"
      style={
        {
          '--mobile-auth-bar-fade-distance': `${MOBILE_AUTH_BAR_FADE_DISTANCE_PX}px`,
          opacity,
        } as CSSProperties
      }
    >
      <BrandMark />
      {href.startsWith('#') ? (
        <a
          href={href}
          aria-label="Back"
          className={backClassName}
          tabIndex={unavailable ? -1 : undefined}
          onClick={onHashBackClick}
        >
          {icon}
        </a>
      ) : (
        <Link
          href={href}
          aria-label="Back"
          className={backClassName}
          tabIndex={unavailable ? -1 : undefined}
        >
          {icon}
        </Link>
      )}
    </header>
  );
}
