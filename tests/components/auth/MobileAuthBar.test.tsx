// tests/components/auth/MobileAuthBar.test.tsx
//
// Tests for the mobile auth header shared by sign-up and sign-in.
//
// Tested:
// - Default Back control goes to /
// - A hash href is used when one is passed
// - The bar is fixed to the top below auth-sm
// - The fade distance is exposed for the scroll-linked CSS
// - Back is not reachable while the scroll cue is still below the fade window
// - On mount with the cue at the foot of the hero, Back is already unavailable
// - Without view timelines the bar is not visible while the cue is on screen
// - Tapping Back eases to the hero instead of jumping via the hash
//
// What is covered:
// - Default landing link, in-page hero target, fixed placement, fade token, a11y, fallback hide
//
// Run with: pnpm test:run tests/components/auth/MobileAuthBar.test.tsx
//
// SEE: src/components/auth/MobileAuthBar.tsx

import { afterEach, describe, it, expect, vi } from 'vitest';
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as easeDocumentScroll from '@/components/auth/easeDocumentScroll';
import MobileAuthBar from '@/components/auth/MobileAuthBar';
import {
  LANDING_HERO_CUE_ID,
  MOBILE_AUTH_BAR_FADE_DISTANCE_PX,
} from '@/components/auth/mobileAuthBarOpacity';

function cueRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    right: 390,
    top,
    bottom: top + 44,
    width: 390,
    height: 44,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function renderSignInBar() {
  return render(
    <div>
      <div id="landing-hero" />
      <a id={LANDING_HERO_CUE_ID} href="#sign-in-form">
        Sign in
      </a>
      <MobileAuthBar href="#landing-hero" />
    </div>,
  );
}

describe('MobileAuthBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Back to the landing page by default', () => {
    render(<MobileAuthBar />);

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/');
  });

  it('uses a hash href when one is passed', () => {
    const { container } = render(<MobileAuthBar href="#landing-hero" />);

    expect(container.querySelector('a[aria-label="Back"]')).toHaveAttribute(
      'href',
      '#landing-hero',
    );
  });

  it('is fixed to the top below auth-sm', () => {
    render(<MobileAuthBar />);

    const bar = screen.getByRole('banner');

    expect(bar).toHaveClass('fixed', 'inset-x-0', 'top-0', 'z-50', 'auth-sm:hidden');
  });

  it('exposes the fade distance for the scroll-linked CSS', () => {
    const { container } = render(<MobileAuthBar href="#landing-hero" />);

    expect(container.querySelector('header')).toHaveStyle({
      '--mobile-auth-bar-fade-distance': `${MOBILE_AUTH_BAR_FADE_DISTANCE_PX}px`,
    });
  });

  it('hides the bar while the cue is on screen when view timelines are unavailable', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(false);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(cueRect(400));

    const { container } = renderSignInBar();

    await waitFor(() => {
      expect(container.querySelector('header')).toHaveStyle({ opacity: '0' });
    });
  });

  it('does not expose Back on mount while the cue is at the foot of the hero', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(cueRect(400));

    renderSignInBar();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    });
  });

  it('does not expose Back while the bar is hidden and restores it once shown', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(cueRect(400));

    renderSignInBar();

    fireEvent.scroll(window);

    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();

    rect.mockReturnValue(cueRect(0));
    fireEvent.scroll(window);

    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument();
  });

  it('eases Back to the hero instead of jumping', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(cueRect(0));
    const ease = vi.spyOn(easeDocumentScroll, 'easeDocumentScrollTo').mockImplementation(() => {});
    const pushState = vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const blur = vi.spyOn(HTMLAnchorElement.prototype, 'blur').mockImplementation(() => {});

    renderSignInBar();

    const back = await screen.findByRole('link', { name: 'Back' });
    const click = createEvent.click(back);
    fireEvent(back, click);

    expect(click.defaultPrevented).toBe(true);
    expect(blur).toHaveBeenCalled();
    expect(ease).toHaveBeenCalledWith(expect.any(Number), false);
    expect(pushState).toHaveBeenCalledWith(null, '', '#landing-hero');
  });
});
