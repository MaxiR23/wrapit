// tests/components/cards/MarkdownToolbar.test.tsx
//
// Tests for the formatting toolbar on a plain text field.
//
// Tested:
// - Bold wraps a selection
// - Bold inserts markers when nothing is selected
// - A click does not steal focus from the field
//
// What is covered:
// - Wrap, empty insert, mousedown preventDefault
//
// Run with: pnpm test:run tests/components/cards/MarkdownToolbar.test.tsx
//
// SEE: src/components/cards/MarkdownToolbar.tsx

import { useRef, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MarkdownToolbar from '@/components/cards/MarkdownToolbar';

function Harness({
  variant = 'full',
  initial = 'foo',
}: {
  variant?: 'inline' | 'full';
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <MarkdownToolbar variant={variant} fieldRef={fieldRef} value={value} onChange={setValue} />
      <textarea
        ref={fieldRef}
        aria-label="Draft"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

describe('MarkdownToolbar', () => {
  it('wraps the selected text in bold', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Draft' }) as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(0, 3);
    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(field).toHaveValue('**foo**');
  });

  it('inserts bold markers when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);

    const field = screen.getByRole('textbox', { name: 'Draft' });
    field.focus();
    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(field).toHaveValue('****');
  });

  it('keeps the field focused after a toolbar click', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Draft' });
    field.focus();
    await user.click(screen.getByRole('button', { name: 'Italic' }));

    expect(field).toHaveFocus();
  });

  it('omits list and code-block actions on the inline variant', () => {
    render(<Harness variant="inline" />);

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Code block' })).not.toBeInTheDocument();
  });
});
