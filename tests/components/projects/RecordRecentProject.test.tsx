// tests/components/projects/RecordRecentProject.test.tsx
//
// Tests for the project-open recents recorder.
//
// Tested:
// - Calls recordRecentProject once on mount with the project id
// - Renders nothing
//
// What is covered:
// - Fire-and-forget record on open
//
// Run with: pnpm test:run tests/components/projects/RecordRecentProject.test.tsx
//
// SEE: src/components/projects/RecordRecentProject.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const recordRecentProject = vi.fn();

vi.mock('@/actions/recordRecentProject', () => ({
  recordRecentProject,
}));

const { default: RecordRecentProject } = await import('@/components/projects/RecordRecentProject');

describe('RecordRecentProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordRecentProject.mockResolvedValue(undefined);
  });

  it('calls recordRecentProject on mount and renders nothing', async () => {
    const { container } = render(<RecordRecentProject projectId="project-1" />);

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => {
      expect(recordRecentProject).toHaveBeenCalledWith('project-1');
    });
    expect(recordRecentProject).toHaveBeenCalledTimes(1);
  });
});
