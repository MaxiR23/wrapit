// tests/components/auth/AuthNav.test.tsx
//
// Tests for the auth nav, which hosts the sign out action.
//
// Tested:
// - Shows sign in and sign up links when there is no session
// - Shows the sign out button when there is a session
// - Renders nothing while the session is still loading
// - Renders nothing on /, /sign-in, /sign-up, /forgot-password, /reset-password and /projects
// - Signs the user out, redirects to the sign in page and refreshes the route
// - Shows a generic message and stays put when sign out fails
//
// What is covered:
// - Signed out state, signed in state, loading state, landing, auth and projects list routes hidden,
//   sign out happy path, sign out failure
//
// Run with: pnpm test:run tests/components/auth/AuthNav.test.tsx
//
// SEE: src/components/auth/AuthNav.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useSession = vi.fn();
const signOut = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const usePathname = vi.fn();

vi.mock('@/lib/authClient', () => ({
  authClient: { useSession, signOut },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => usePathname(),
}));

const { default: AuthNav } = await import('@/components/auth/AuthNav');

const session = {
  user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' },
  session: { id: 'session-1' },
};

describe('AuthNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.mockReturnValue({ data: null, isPending: false });
    usePathname.mockReturnValue('/projects/project-1');
    signOut.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('shows sign in and sign up links when there is no session', () => {
    render(<AuthNav />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('shows the sign out button when there is a session', () => {
    useSession.mockReturnValue({ data: session, isPending: false });

    render(<AuthNav />);

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('renders nothing while the session is still loading', () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    render(<AuthNav />);

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('renders nothing on the landing page', () => {
    usePathname.mockReturnValue('/');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the sign in page', () => {
    usePathname.mockReturnValue('/sign-in');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the sign up page', () => {
    usePathname.mockReturnValue('/sign-up');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the forgot-password page', () => {
    usePathname.mockReturnValue('/forgot-password');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the projects list page', () => {
    usePathname.mockReturnValue('/projects');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the reset-password page', () => {
    usePathname.mockReturnValue('/reset-password');

    const { container } = render(<AuthNav />);

    expect(container).toBeEmptyDOMElement();
  });

  it('signs the user out, redirects to the sign in page and refreshes the route', async () => {
    useSession.mockReturnValue({ data: session, isPending: false });
    const user = userEvent.setup();

    render(<AuthNav />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a generic message and stays put when sign out fails', async () => {
    useSession.mockReturnValue({ data: session, isPending: false });
    const leakyMessage = 'PrismaClientKnownRequestError: connection to 10.0.0.5:5432 refused';
    signOut.mockResolvedValue({
      data: null,
      error: { message: leakyMessage, status: 500, statusText: 'Internal Server Error' },
    });
    const user = userEvent.setup();

    render(<AuthNav />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign out. Please try again.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('10.0.0.5');
    expect(push).not.toHaveBeenCalled();
  });
});
