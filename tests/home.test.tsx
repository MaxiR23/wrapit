import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('Home page', () => {
  it('renders the wrapit heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'wrapit' })).toBeInTheDocument();
  });
});
