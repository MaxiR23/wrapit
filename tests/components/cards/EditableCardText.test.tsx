// tests/components/cards/EditableCardText.test.tsx
//
// Tests for display vs edit of card text that may contain markdown and service links.
//
// Tested:
// - Display shows the recognised label and rendered markdown
// - Enter or Space on the display opens the textarea with the raw source
// - Clicking the chip does not enter edit
// - A toolbar click does not exit edit
// - Re-entering edit after blur shows the same source
// - View-only text is not focusable as an editor
//
// What is covered:
// - Keyboard edit, click-to-edit, view-only, chip click, toolbar blur, save-and-reopen
//
// Run with: pnpm test:run tests/components/cards/EditableCardText.test.tsx
//
// SEE: src/components/cards/EditableCardText.tsx

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EditableCardText from '@/components/cards/EditableCardText';

const GITHUB_ISSUE = 'https://github.com/wrapit/wrapit/issues/42';

function Harness({
  canEdit = true,
  initial = GITHUB_ISSUE,
  variant = 'inline' as const,
}: {
  canEdit?: boolean;
  initial?: string;
  variant?: 'inline' | 'full';
}) {
  const [value, setValue] = useState(initial);
  return (
    <EditableCardText
      value={value}
      ariaLabel="Title"
      canEdit={canEdit}
      rows={2}
      variant={variant}
      onChange={setValue}
      onBlur={() => {}}
    />
  );
}

describe('EditableCardText', () => {
  it('shows the recognised label until edit starts', () => {
    render(<Harness />);

    expect(screen.getByRole('link', { name: 'wrapit/wrapit#42' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });

  it('renders markdown at rest and opens the raw source on Enter', async () => {
    const user = userEvent.setup();
    render(<Harness initial="**Title**" />);

    expect(screen.getByLabelText('Title').querySelector('strong')).toHaveTextContent('Title');
    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('**Title**');
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

  it('does not exit edit when a toolbar button is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness initial="foo" />);

    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');
    const field = screen.getByRole('textbox', { name: 'Title' }) as HTMLTextAreaElement;
    field.setSelectionRange(0, 3);
    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('**foo**');
  });

  it('shows the same source after blur and re-entering edit', async () => {
    const user = userEvent.setup();
    render(<Harness initial="**Title**" />);

    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title').querySelector('strong')).toHaveTextContent('Title');

    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('**Title**');
  });

  it('does not make a view-only field an editor', async () => {
    const user = userEvent.setup();
    render(<Harness canEdit={false} />);

    const display = screen.getByLabelText('Title');
    expect(display).not.toHaveAttribute('tabindex');
    await user.click(display);
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });

  it('does not save on blur when saveOnBlur is false', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const onBlur = vi.fn();
    render(
      <EditableCardText
        value="Looks **good**"
        ariaLabel="Edit comment body"
        canEdit
        rows={3}
        editing
        saveOnBlur={false}
        activateOnDisplay={false}
        onChange={() => {}}
        onBlur={onBlur}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    screen.getByRole('textbox', { name: 'Edit comment body' }).focus();
    await user.tab();

    expect(onSave).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Edit comment body' })).toBeInTheDocument();
  });

  it('calls onCancel from Cancel and Escape when saveOnBlur is false', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <EditableCardText
        value="Looks **good**"
        ariaLabel="Edit comment body"
        canEdit
        rows={3}
        editing
        saveOnBlur={false}
        activateOnDisplay={false}
        onChange={() => {}}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();

    screen.getByRole('textbox', { name: 'Edit comment body' }).focus();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not open on click when activateOnDisplay is false', async () => {
    const user = userEvent.setup();
    render(
      <EditableCardText
        value="Looks **good**"
        ariaLabel="Edit comment body"
        canEdit
        rows={3}
        activateOnDisplay={false}
        saveOnBlur={false}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByLabelText('Edit comment body'));
    expect(screen.queryByRole('textbox', { name: 'Edit comment body' })).not.toBeInTheDocument();
  });
});
