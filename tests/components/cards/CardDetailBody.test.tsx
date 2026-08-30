// tests/components/cards/CardDetailBody.test.tsx
//
// Tests for coalesced assignee and label writes on the card detail pane,
// and for service-link display in title and description.
//
// Tested:
// - Rapid assignee toggles persist the last selection regardless of response order
// - Rapid label selections persist the last label chosen
// - After the viewer zone resolves, a due moment shows that zone's wall time
// - A GitHub URL in the title and description renders as the same labelled link
// - Enter on the title display opens the textarea with the raw URL
//
// What is covered:
// - One in-flight write per card for assignees and for label; a stale success
//   still advances persisted so the correction write can run
// - Due value resync when the viewer zone becomes known
// - Board and detail share the same derived service-link label
//
// Run with: pnpm test:run tests/components/cards/CardDetailBody.test.tsx
//
// SEE: src/components/cards/CardDetailBody.tsx

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BoardCardData, BoardMember } from '@/components/projects/boardTypes';
import type { LabelView } from '@/lib/labels';

vi.mock('@/actions/updateCardField', () => ({
  updateCardField: vi.fn(async (input: { value: string }) => ({ data: { value: input.value } })),
}));
vi.mock('@/actions/updateCardAssignees', () => ({
  updateCardAssignees: vi.fn(),
}));
vi.mock('@/actions/updateCardLabel', () => ({
  updateCardLabel: vi.fn(),
}));
vi.mock('@/actions/createSubtask', () => ({ createSubtask: vi.fn() }));
vi.mock('@/actions/updateSubtaskField', () => ({
  updateSubtaskField: vi.fn(async (input: { value: string | boolean }) => ({
    data: { value: input.value },
  })),
}));
vi.mock('@/actions/deleteSubtask', () => ({ deleteSubtask: vi.fn() }));
vi.mock('@/actions/createComment', () => ({ createComment: vi.fn() }));

const useViewerTimeZone = vi.fn((): string | null => null);
vi.mock('@/components/projects/ViewerTimeZoneProvider', () => ({
  useViewerTimeZone: () => useViewerTimeZone(),
}));

const { default: CardDetailBody } = await import('@/components/cards/CardDetailBody');
const { updateCardAssignees } = await import('@/actions/updateCardAssignees');
const { updateCardLabel } = await import('@/actions/updateCardLabel');

const ada: BoardMember = { id: 'user-ada', name: 'Ada Lovelace', username: 'ada' };
const grace: BoardMember = { id: 'user-grace', name: 'Grace Hopper', username: 'grace' };
const members = [ada, grace];

const labels: LabelView[] = [
  { id: 'l0', name: 'Design', tone: 'blue', order: 0 },
  { id: 'l1', name: 'Bug', tone: 'red', order: 1 },
  { id: 'l2', name: 'Feature', tone: 'green', order: 2 },
];

const baseCard: BoardCardData = {
  id: 'card-1',
  title: 'Write the board',
  code: 'WB-1',
  description: 'Cover ownership',
  dueDate: null,
  comments: [],
  subtasks: [],
  assignees: [ada],
  label: { id: 'l0', name: 'Design', tone: 'blue' },
};

function Harness({ card: initialCard }: { card?: BoardCardData }) {
  const [card, setCard] = useState(initialCard ?? baseCard);
  return (
    <CardDetailBody
      card={card}
      columnId="column-todo"
      columns={[{ id: 'column-todo', title: 'To do' }]}
      members={members}
      labels={labels}
      currentUser={ada}
      askingDelete={false}
      onAskingDelete={vi.fn()}
      onCardPatch={(patch) => setCard((current) => ({ ...current, ...patch }))}
      onMoveColumn={vi.fn()}
      onArchive={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe('CardDetailBody', () => {
  beforeEach(() => {
    useViewerTimeZone.mockReturnValue(null);
  });
  it('writes the last assignee selection even when an earlier response arrives last', async () => {
    const user = userEvent.setup();
    let releaseFirst: (value: { data: { assignees: BoardMember[] } }) => void = () => {};
    vi.mocked(updateCardAssignees)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(async (input: { assigneeIds: string[] }) => ({
        data: {
          assignees: members.filter((member) => input.assigneeIds.includes(member.id)),
        },
      }));

    render(<Harness />);

    await user.click(screen.getAllByRole('button', { name: 'Grace Hopper' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Ada Lovelace' })[0]!);

    expect(updateCardAssignees).toHaveBeenCalledTimes(1);
    expect(updateCardAssignees).toHaveBeenCalledWith({
      cardId: 'card-1',
      assigneeIds: ['user-ada', 'user-grace'],
    });

    releaseFirst({ data: { assignees: [ada, grace] } });

    await waitFor(() => expect(updateCardAssignees).toHaveBeenCalledTimes(2));
    expect(updateCardAssignees).toHaveBeenLastCalledWith({
      cardId: 'card-1',
      assigneeIds: ['user-grace'],
    });
  });

  it('writes the last label chosen even when an earlier response arrives last', async () => {
    const user = userEvent.setup();
    let releaseFirst: (value: { data: { labelId: string | null } }) => void = () => {};
    vi.mocked(updateCardLabel)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockImplementation(async (input: { labelId?: string | null }) => ({
        data: { labelId: input.labelId ?? null },
      }));

    render(<Harness />);

    await user.click(screen.getAllByRole('button', { name: 'Bug' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Feature' })[0]!);

    expect(updateCardLabel).toHaveBeenCalledTimes(1);
    expect(updateCardLabel).toHaveBeenCalledWith({ cardId: 'card-1', labelId: 'l1' });

    releaseFirst({ data: { labelId: 'l1' } });

    await waitFor(() => expect(updateCardLabel).toHaveBeenCalledTimes(2));
    expect(updateCardLabel).toHaveBeenLastCalledWith({ cardId: 'card-1', labelId: 'l2' });
  });

  it('shows the viewer-zone wall time once the viewer zone resolves', () => {
    const madridCard: BoardCardData = {
      ...baseCard,
      dueDate: new Date(Date.UTC(2026, 7, 25, 14, 0)),
      dueTimeZone: 'Europe/Madrid',
    };
    useViewerTimeZone.mockReturnValue(null);
    const { rerender } = render(<Harness card={madridCard} />);

    expect(screen.getAllByLabelText('Due time')[0]).toHaveValue('16:00');

    useViewerTimeZone.mockReturnValue('America/Argentina/Buenos_Aires');
    rerender(<Harness card={madridCard} />);

    expect(screen.getAllByLabelText('Due time')[0]).toHaveValue('11:00');
  });

  it('shows a GitHub issue in the title as the same labelled link as the board', () => {
    render(<Harness card={{ ...baseCard, title: 'https://github.com/wrapit/wrapit/issues/42' }} />);

    const link = screen.getByRole('link', { name: 'wrapit/wrapit#42' });
    expect(link).toHaveAttribute('href', 'https://github.com/wrapit/wrapit/issues/42');
  });

  it('shows a recognised description link with the same label as the board would', () => {
    render(
      <Harness
        card={{
          ...baseCard,
          description: 'See https://github.com/wrapit/wrapit/issues/42 please',
        }}
      />,
    );

    const link = screen.getByRole('link', { name: 'wrapit/wrapit#42' });
    expect(link).toHaveAttribute('href', 'https://github.com/wrapit/wrapit/issues/42');
  });

  it('opens the raw title URL in a textarea after Enter on the display', async () => {
    const user = userEvent.setup();
    render(<Harness card={{ ...baseCard, title: 'https://github.com/wrapit/wrapit/issues/42' }} />);

    screen.getByLabelText('Title').focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'https://github.com/wrapit/wrapit/issues/42',
    );
  });
});
