// tests/components/cards/ServiceLinkText.test.tsx
//
// Tests for rendering recognised service URLs in user-supplied text.
//
// Tested:
// - A GitHub URL renders as a labelled link with the sanitised href
// - Each of the five services renders a labelled link
// - An unrecognised URL stays as the raw address, not a link
// - A javascript: string does not become a link
// - A recognised chip includes a decorative icon
//
// What is covered:
// - Recognised render, unrecognised unchanged, hostile URL, icon
//
// Run with: pnpm test:run tests/components/cards/ServiceLinkText.test.tsx
//
// SEE: src/components/cards/ServiceLinkText.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ServiceLinkText from '@/components/cards/ServiceLinkText';

const GITHUB_ISSUE = 'https://github.com/wrapit/wrapit/issues/42';

describe('ServiceLinkText', () => {
  it('renders a labelled link for each recognised service', () => {
    const cases = [
      ['https://github.com/wrapit/wrapit/issues/42', 'wrapit/wrapit#42'],
      ['https://www.figma.com/design/abc123/My-Design-File', 'My Design File'],
      ['https://www.notion.so/My-Page-Title-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'My Page Title'],
      ['https://docs.google.com/document/d/abc/edit', 'Google Doc'],
      ['https://wrapit.slack.com/archives/C01234567/p1', 'Slack'],
    ] as const;

    for (const [href, name] of cases) {
      const { unmount } = render(<ServiceLinkText text={href} />);
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('leaves an unrecognised URL as the raw address', () => {
    render(<ServiceLinkText text="https://example.com/x" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('https://example.com/x')).toBeInTheDocument();
  });

  it('does not turn a javascript URL into a link', () => {
    render(<ServiceLinkText text="javascript:alert(1)" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
  });

  it('does not bubble a click on the chip', async () => {
    const onOuterClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onOuterClick}>
        <ServiceLinkText text={GITHUB_ISSUE} />
      </div>,
    );

    await user.click(screen.getByRole('link', { name: 'wrapit/wrapit#42' }));

    expect(onOuterClick).not.toHaveBeenCalled();
  });
});
