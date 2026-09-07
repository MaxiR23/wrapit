// tests/components/projects/BoardToast.test.tsx
//
// Tests for the board toast placement above the phone tab bar.
//
// Tested:
// - Phone bottom offset uses the tab-bar token, not a hardcoded bottom-24
// - Horizontal inset is 1rem from the safe-fixed root, not the physical edge
//
// What is covered:
// - Tab-bar offset class, inset-x-4, portal parent
//
// Run with: pnpm test:run tests/components/projects/BoardToast.test.tsx
//
// SEE: src/components/projects/BoardToast.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BoardToast from '@/components/projects/BoardToast';

describe('BoardToast', () => {
  it('sits above the phone tab bar using the shared offset token', () => {
    render(<BoardToast toast={{ message: 'Card archived', role: 'status' }} onDismiss={vi.fn()} />);

    const toast = screen.getByRole('status');

    expect(toast).toHaveClass('max-tablet:bottom-[calc(var(--spacing-mobile-tab-bar)+1.5rem)]');
    expect(toast).toHaveClass('inset-x-4');
    expect(toast).not.toHaveClass('bottom-24');
    expect(toast.parentElement?.id).toBe('safe-fixed-root');
  });
});
