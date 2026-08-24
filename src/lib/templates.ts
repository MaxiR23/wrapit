export const PROJECT_TEMPLATES = [
  { id: 'blank', name: 'Blank', columns: ['To do', 'In progress', 'In review', 'Done'] },
  { id: 'product', name: 'Product', columns: ['Backlog', 'In progress', 'In review', 'Done'] },
  { id: 'marketing', name: 'Marketing', columns: ['Ideas', 'Production', 'Published'] },
  { id: 'support', name: 'Support', columns: ['Incoming', 'Investigating', 'Resolved'] },
  { id: 'content', name: 'Content', columns: ['Script', 'Editing', 'Scheduled', 'Published'] },
  { id: 'sales', name: 'Sales', columns: ['Leads', 'Contacted', 'Proposal', 'Closed'] },
  { id: 'sprint', name: 'Sprint', columns: ['Backlog', 'In progress', 'Review', 'Demo', 'Done'] },
  { id: 'hiring', name: 'Hiring', columns: ['Applicants', 'Interviews', 'Offer', 'Joined'] },
  { id: 'events', name: 'Events', columns: ['To define', 'Confirmed', 'In progress', 'Closed'] },
] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATES)[number]['id'];

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  columns: readonly string[];
};

/** All project templates (id, display name, ordered column titles) for the UI. */
export function listProjectTemplates(): readonly ProjectTemplate[] {
  return PROJECT_TEMPLATES;
}

/** Ordered column titles for a template id, or undefined when the id is unknown. */
export function getTemplateColumns(templateId: string): readonly string[] | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId)?.columns;
}
