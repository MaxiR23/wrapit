// tests/components/auth/AuthFormIsland.test.tsx
//
// Tests for the shared auth form island layout.
//
// Tested:
// - Below auth-sm the island fills the padded canvas
// - Content stays centred in the island
//
// What is covered:
// - Phone min-height, centering
//
// Run with: pnpm test:run tests/components/auth/AuthFormIsland.test.tsx
//
// SEE: src/components/auth/AuthFormIsland.tsx

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import AuthFormIsland from '@/components/auth/AuthFormIsland';

describe('AuthFormIsland', () => {
  it('fills the padded canvas below auth-sm and keeps content centred', () => {
    const { container } = render(
      <AuthFormIsland>
        <p>Form</p>
      </AuthFormIsland>,
    );

    const island = container.querySelector('.form-island');

    expect(island).toHaveClass(
      'max-auth-sm:min-h-full',
      'flex',
      'flex-1',
      'items-center',
      'justify-center',
    );
  });
});
