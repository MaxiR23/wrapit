// tests/lib/templates.test.ts
//
// Tests for the project template catalog.
//
// Tested:
// - getTemplateColumns returns the ordered titles for each of the 9 templates
// - listProjectTemplates returns all 9 templates with id, name, and columns
// - getTemplateColumns returns undefined for an unknown id
//
// What is covered:
// - Happy path for every template, listable catalog, unknown id
//
// Run with: pnpm test:run tests/lib/templates.test.ts
//
// SEE: src/lib/templates.ts

import { describe, it, expect } from 'vitest';

import { getTemplateColumns, listProjectTemplates } from '@/lib/templates';

const expectedTemplates = [
  { id: 'blank', name: 'Blank', columns: ['To do', 'In progress', 'Done'] },
  { id: 'product', name: 'Product', columns: ['Backlog', 'In progress', 'In review', 'Done'] },
  { id: 'marketing', name: 'Marketing', columns: ['Ideas', 'Production', 'Published'] },
  { id: 'support', name: 'Support', columns: ['Incoming', 'Investigating', 'Resolved'] },
  { id: 'content', name: 'Content', columns: ['Script', 'Editing', 'Scheduled', 'Published'] },
  { id: 'sales', name: 'Sales', columns: ['Leads', 'Contacted', 'Proposal', 'Closed'] },
  { id: 'sprint', name: 'Sprint', columns: ['Backlog', 'In progress', 'Review', 'Demo', 'Done'] },
  { id: 'hiring', name: 'Hiring', columns: ['Applicants', 'Interviews', 'Offer', 'Joined'] },
  { id: 'events', name: 'Events', columns: ['To define', 'Confirmed', 'In progress', 'Closed'] },
] as const;

describe('getTemplateColumns', () => {
  it.each(expectedTemplates)(
    'returns the ordered columns for the $id template',
    ({ id, columns }) => {
      expect(getTemplateColumns(id)).toEqual([...columns]);
    },
  );

  it('returns undefined for an unknown template id', () => {
    expect(getTemplateColumns('unknown')).toBeUndefined();
  });
});

describe('listProjectTemplates', () => {
  it('returns all 9 templates with id, name, and columns', () => {
    const templates = listProjectTemplates();

    expect(templates).toHaveLength(9);
    expect(templates.map((template) => template.id)).toEqual(expectedTemplates.map((t) => t.id));

    for (const expected of expectedTemplates) {
      const listed = templates.find((template) => template.id === expected.id);
      expect(listed).toEqual({
        id: expected.id,
        name: expected.name,
        columns: [...expected.columns],
      });
    }
  });
});
