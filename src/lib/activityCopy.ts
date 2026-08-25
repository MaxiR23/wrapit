export type ActivityCopy = {
  locale: string;
  today: string;
  yesterday: string;
  empty: string;
  loadEarlier: string;
  logLabel: string;
  fallback: (input: { actorName: string }) => string;
  cardCreated: (input: { actorName: string; cardTitle: string; columnTitle: string }) => string;
  cardMoved: (input: {
    actorName: string;
    cardTitle: string;
    fromColumnTitle: string;
    toColumnTitle: string;
  }) => string;
  cardArchived: (input: { actorName: string; cardTitle: string }) => string;
  cardDeleted: (input: { actorName: string; cardTitle: string }) => string;
  assigneesChanged: (input: {
    actorName: string;
    cardTitle: string;
    assigneeNames: string[];
  }) => string;
  labelChanged: (input: {
    actorName: string;
    cardTitle: string;
    labelName: string | null;
  }) => string;
  dueDateChanged: (input: {
    actorName: string;
    cardTitle: string;
    dueDateLabel: string | null;
  }) => string;
  commentAdded: (input: { actorName: string; cardTitle: string }) => string;
  memberAdded: (input: { actorName: string }) => string;
  memberRemoved: (input: { actorName: string; memberName: string }) => string;
};

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.slice(0, -1).join(', ');
  return `${rest}, and ${names[names.length - 1]}`;
}

/** English activity copy. A second language is another table, not a new renderer. */
export const activityCopy: ActivityCopy = {
  locale: 'en-GB',
  today: 'Today',
  yesterday: 'Yesterday',
  empty: 'No activity yet.',
  loadEarlier: 'Load earlier activity',
  logLabel: 'Activity log',
  fallback: ({ actorName }) => `${actorName} updated the board.`,
  cardCreated: ({ actorName, cardTitle, columnTitle }) =>
    `${actorName} created "${cardTitle}" in ${columnTitle}.`,
  cardMoved: ({ actorName, cardTitle, fromColumnTitle, toColumnTitle }) =>
    `${actorName} moved "${cardTitle}" from ${fromColumnTitle} to ${toColumnTitle}.`,
  cardArchived: ({ actorName, cardTitle }) => `${actorName} archived "${cardTitle}".`,
  cardDeleted: ({ actorName, cardTitle }) => `${actorName} deleted "${cardTitle}".`,
  assigneesChanged: ({ actorName, cardTitle, assigneeNames }) => {
    if (assigneeNames.length === 0) {
      return `${actorName} cleared assignees on "${cardTitle}".`;
    }
    return `${actorName} assigned ${joinNames(assigneeNames)} to "${cardTitle}".`;
  },
  labelChanged: ({ actorName, cardTitle, labelName }) => {
    if (labelName == null || labelName === '') {
      return `${actorName} removed the label from "${cardTitle}".`;
    }
    return `${actorName} changed the label of "${cardTitle}" to ${labelName}.`;
  },
  dueDateChanged: ({ actorName, cardTitle, dueDateLabel }) => {
    if (dueDateLabel == null || dueDateLabel === '') {
      return `${actorName} cleared the due date of "${cardTitle}".`;
    }
    return `${actorName} set the due date of "${cardTitle}" to ${dueDateLabel}.`;
  },
  commentAdded: ({ actorName, cardTitle }) => `${actorName} commented on "${cardTitle}".`,
  memberAdded: ({ actorName }) => `${actorName} joined the project.`,
  memberRemoved: ({ actorName, memberName }) =>
    `${actorName} removed ${memberName} from the project.`,
};
