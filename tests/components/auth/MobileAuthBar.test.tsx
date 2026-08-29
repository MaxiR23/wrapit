// tests/components/auth/MobileAuthBar.test.tsx
//
// Tests for the mobile auth header shared by sign-up and sign-in.
//
// Tested:
// - Default Back control goes to /
// - A hash href is used when one is passed
// - The bar is fixed to the top below auth-sm
// - The fade distance is exposed for the scroll-linked CSS
// - Back is not reachable while the covering hero hides the bar, and is once shown
// - On mount at the top of the page, Back is already unavailable
// - Without scroll timelines the bar is not visible while the hero is on screen
//
// What is covered:
// - Default landing link, in-page hero target, fixed placement, fade token, a11y, fallback hide
//
// Run with: pnpm test:run tests/components/auth/MobileAuthBar.test.tsx
//
// SEE: src/components/auth/MobileAuthBar.tsx

import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MobileAuthBar from '@/components/auth/MobileAuthBar';
import { MOBILE_AUTH_BAR_FADE_DISTANCE_PX } from '@/components/auth/mobileAuthBarOpacity';

function heroRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    right: 390,
    top,
    bottom: top + 800,
    width: 390,
    height: 800,
    toJSON() {
      return {};
    },
  } as DOMRect;
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

  it('hides the bar while the hero is on screen when scroll timelines are unavailable', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(false);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(heroRect(0));

    const { container } = render(
      <div>
        <div id="landing-hero" />
        <MobileAuthBar href="#landing-hero" />
      </div>,
    );

    await waitFor(() => {
      expect(container.querySelector('header')).toHaveStyle({ opacity: '0' });
    });
  });

  it('does not expose Back on mount while the covering hero is at the top of the page', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(heroRect(0));

    render(
      <div>
        <div id="landing-hero" />
        <MobileAuthBar href="#landing-hero" />
      </div>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    });
  });

  it('does not expose Back while the bar is hidden and restores it once shown', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue(heroRect(0));

    render(
      <div>
        <div id="landing-hero" />
        <MobileAuthBar href="#landing-hero" />
      </div>,
    );

    fireEvent.scroll(window);

    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();

    rect.mockReturnValue(heroRect(-MOBILE_AUTH_BAR_FADE_DISTANCE_PX));
    fireEvent.scroll(window);

    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument();
  });
});
