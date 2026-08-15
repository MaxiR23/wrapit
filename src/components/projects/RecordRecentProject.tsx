'use client';

import { useEffect } from 'react';

import { recordRecentProject } from '@/actions/recordRecentProject';

export default function RecordRecentProject({ projectId }: { projectId: string }) {
  useEffect(() => {
    void recordRecentProject(projectId);
  }, [projectId]);

  return null;
}
