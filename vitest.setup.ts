import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

import { SAFE_FIXED_ROOT_ID } from '@/lib/safeFixedRoot';

process.env.BETTER_AUTH_SECRET ??= 'test-secret-at-least-32-characters-long';

beforeEach(() => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SAFE_FIXED_ROOT_ID)) return;
  const root = document.createElement('div');
  root.id = SAFE_FIXED_ROOT_ID;
  root.className = 'safe-fixed-root';
  document.body.appendChild(root);
});
