// tests/components/projects/ProjectsTopbar.test.tsx
//
// Tests for the projects topbar account button, which hosts a temporary sign out.
//
// Tested:
// - Signs the user out, redirects to the sign in page and refreshes the route
// - Shows a generic message and stays put when sign out fails
//
// What is covered:
// - Sign out happy path, sign out failure
//
// Run with: pnpm test:run tests/components/projects/ProjectsTopbar.test.tsx
//
// SEE: src/components/projects/ProjectsTopbar.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signOut = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { signOut },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const { default: ProjectsTopbar } = await import('@/components/projects/ProjectsTopbar');

const user = { name: 'Ada Lovelace', username: 'ada', initials: 'AL' };

describe('ProjectsTopbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('signs the user out, redirects to the sign in page and refreshes the route', async () => {
    const events = userEvent.setup();

    render(<ProjectsTopbar user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a generic message and stays put when sign out fails', async () => {
    const leakyMessage = 'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused';
    signOut.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    const events = userEvent.setup();

    render(<ProjectsTopbar user={user} />);
    await events.click(screen.getByRole('button', { name: 'Account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign out. Please try again.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('10.0.0.5');
    expect(push).not.toHaveBeenCalled();
  });
});
