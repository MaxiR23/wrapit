// tests/components/account/ProfileFieldRow.test.tsx
//
// Tests for the profile field row layout.
//
// Tested:
// - Stacks label, input, and visibility control in one column below md
// - Keeps the three-column desktop grid from md up
//
// What is covered:
// - Narrow viewport stack, desktop grid
//
// Run with: pnpm test:run tests/components/account/ProfileFieldRow.test.tsx
//
// SEE: src/components/account/ProfileFieldRow.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ProfileFieldRow from '@/components/account/ProfileFieldRow';
import { VisibilityMenuProvider } from '@/components/account/VisibilityMenuProvider';

describe('ProfileFieldRow', () => {
  it('stacks below the breakpoint and uses the three-column grid above it', () => {
    const { container } = render(
      <VisibilityMenuProvider>
        <ProfileFieldRow
          label="Pronouns"
          htmlFor="profile-pronouns"
          visibilityKey="pronouns"
          visibility="anyone"
          onVisibilityChange={() => {}}
        >
          <input id="profile-pronouns" />
        </ProfileFieldRow>
      </VisibilityMenuProvider>,
    );

    const row = container.firstElementChild;
    expect(row).toHaveClass('grid-cols-1');
    expect(row?.className).toContain('md:grid-cols-[200px_1fr_232px]');
    expect(screen.getByText('Pronouns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pronouns visibility: Anyone' })).toBeInTheDocument();
  });
});
