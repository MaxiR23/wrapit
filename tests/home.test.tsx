// tests/home.test.tsx
//
// Tests for the home page.
//
// Tested:
// - Renders the wrapit heading
//
// What is covered:
// - Happy path
//
// Run with: pnpm test:run tests/home.test.tsx
//
// SEE: src/app/page.tsx

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import Home from '@/app/page';

describe('Home page', () => {
  it('renders the wrapit heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'wrapit' })).toBeInTheDocument();
  });
});
