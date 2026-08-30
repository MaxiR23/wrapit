// tests/components/cards/EditableServiceText.test.tsx
//
// Tests for display vs edit of card text that may contain service links.
//
// Tested:
// - Display shows the recognised label
// - Enter or Space on the display opens the textarea with the raw URL
// - Clicking the chip does not enter edit
// - View-only text is not focusable as an editor
//
// What is covered:
// - Keyboard edit, click-to-edit, view-only, chip click
//
// Run with: pnpm test:run tests/components/cards/EditableServiceText.test.tsx
//
// SEE: src/components/cards/EditableServiceText.tsx

import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EditableServiceText from '@/components/cards/EditableServiceText';

const GITHUB_ISSUE = 'https://github.com/wrapit/wrapit/issues/42';

function Harness({
  canEdit = true,
  initial = GITHUB_ISSUE,
}: {
  canEdit?: boolean;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <EditableServiceText
      value={value}
      ariaLabel="Title"
      canEdit={canEdit}
      rows={2}
      onChange={setValue}
      onBlur={() => {}}
    />
  );
}

describe('EditableServiceText', () => {
  it('shows the recognised label until edit starts', () => {
    render(<Harness />);

    expect(screen.getByRole('link', { name: 'wrapit/wrapit#42' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });

  it('opens the raw URL in a textarea when Enter is pressed on the display', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(GITHUB_ISSUE);
  });

  it('opens the raw URL in a textarea when Space is pressed on the display', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByLabelText('Title').focus();
    await user.keyboard(' ');

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(GITHUB_ISSUE);
  });

  it('does not enter edit when the recognised link is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('link', { name: 'wrapit/wrapit#42' }));

    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });

  it('does not make a view-only field an editor', async () => {
    const user = userEvent.setup();
    render(<Harness canEdit={false} />);

    const display = screen.getByLabelText('Title');
    expect(display).not.toHaveAttribute('tabindex');
    await user.click(display);
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });
});
