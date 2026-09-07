// tests/components/ui/dialog.test.tsx
//
// Tests for DialogContent portal targeting and the default center layout.
//
// Tested:
// - Portals overlay and content into #safe-fixed-root
// - Centered content is constrained with max-h-full
// - Overlay opts out of the safe rect with data-safe-scrim
//
// What is covered:
// - Portal parent, center max-height, scrim exception attribute
//
// Run with: pnpm test:run tests/components/ui/dialog.test.tsx
//
// SEE: src/components/ui/dialog.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Dialog, DialogContent } from '@/components/ui/dialog';

describe('DialogContent', () => {
  it('portals centered content into the safe-fixed root and marks the overlay as a scrim', () => {
    render(
      <Dialog open>
        <DialogContent>Hello</DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole('dialog');
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(content).toHaveClass('top-1/2', 'left-1/2', 'max-h-full');
    expect(content.parentElement?.id).toBe('safe-fixed-root');
    expect(overlay).toHaveAttribute('data-safe-scrim');
    expect(overlay?.parentElement?.id).toBe('safe-fixed-root');
  });
});
