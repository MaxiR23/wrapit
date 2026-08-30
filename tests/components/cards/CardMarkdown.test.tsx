// tests/components/cards/CardMarkdown.test.tsx
//
// Tests for rendering the closed markdown subset on card text.
//
// Tested:
// - Bold, italic, inline code, code blocks, lists, and links render
// - A service URL inside bold or a list item still chips
// - A URL inside a fence stays code
// - A javascript markdown link is not an anchor
// - A markdown link whose label is a service URL is a single anchor
// - Clicking a chip does not bubble
// - A newline stays one line inline and breaks in the full variant
//
// What is covered:
// - Feature render, service-link composition, hostile href, nested-anchor guard,
//   click isolation, inline newline vs full break
//
// Run with: pnpm test:run tests/components/cards/CardMarkdown.test.tsx
//
// SEE: src/components/cards/CardMarkdown.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CardMarkdown from '@/components/cards/CardMarkdown';

const GITHUB_ISSUE = 'https://github.com/wrapit/wrapit/issues/42';

describe('CardMarkdown', () => {
  it('renders bold, italic, inline code, a list, and a code block', () => {
    const { container } = render(
      <CardMarkdown text={'**bold** *italic* `code`\n\n- item\n\n```\nconst n = 1;\n```'} />,
    );

    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
    expect(container.querySelector('code')).toHaveTextContent('code');
    expect(screen.getByRole('listitem')).toHaveTextContent('item');
    expect(container.querySelector('pre')).toHaveTextContent('const n = 1;');
  });

  it('renders a generic http link with a sanitised href', () => {
    render(<CardMarkdown text="[docs](https://example.com/x)" />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the typed label on a markdown link to a recognised service', () => {
    render(<CardMarkdown text={`[the issue](${GITHUB_ISSUE})`} />);

    const link = screen.getByRole('link', { name: 'the issue' });
    expect(link).toHaveAttribute('href', GITHUB_ISSUE);
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('chips a service URL inside bold and inside a list item', () => {
    const { unmount } = render(<CardMarkdown text={`**see ${GITHUB_ISSUE}**`} />);
    expect(screen.getByRole('link', { name: 'wrapit/wrapit#42' }).closest('strong')).not.toBeNull();
    unmount();

    render(<CardMarkdown text={`- ${GITHUB_ISSUE}`} />);
    expect(screen.getByRole('listitem').querySelector('a')).toHaveAttribute('href', GITHUB_ISSUE);
  });

  it('does not chip a service URL inside a fence', () => {
    render(<CardMarkdown text={'```\n' + GITHUB_ISSUE + '\n```'} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(GITHUB_ISSUE)).toBeInTheDocument();
  });

  it('does not turn a javascript markdown link into an anchor', () => {
    render(<CardMarkdown text="[click](javascript:alert(1))" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('[click](javascript:alert(1))')).toBeInTheDocument();
  });

  it('renders a markdown link whose label is a service URL as a single anchor', () => {
    render(<CardMarkdown text={`[${GITHUB_ISSUE}](https://example.com/x)`} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com/x');
    expect(links[0]).toHaveTextContent(GITHUB_ISSUE);
    expect(links[0].querySelector('a')).toBeNull();
  });

  it('does not bubble a click on a chip', async () => {
    const onOuterClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onOuterClick}>
        <CardMarkdown text={GITHUB_ISSUE} />
      </div>,
    );

    await user.click(screen.getByRole('link', { name: 'wrapit/wrapit#42' }));

    expect(onOuterClick).not.toHaveBeenCalled();
  });

  it('leaves list markers as characters in the inline variant', () => {
    const { container } = render(<CardMarkdown text="- a title" variant="inline" />);

    expect(container.querySelector('ul')).toBeNull();
    expect(screen.getByText('- a title')).toBeInTheDocument();
  });

  it('keeps a newline on one line in the inline variant and breaks in the full variant', () => {
    const { container, rerender } = render(<CardMarkdown text={'hello\nworld'} variant="inline" />);

    expect(container.querySelector('br')).toBeNull();
    expect(container).toHaveTextContent(/hello\s*world/);

    rerender(<CardMarkdown text={'hello\nworld'} />);
    expect(container.querySelector('br')).not.toBeNull();
  });
});
