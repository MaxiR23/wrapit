import { createAuthClient } from 'better-auth/react';

// No baseURL: the client defaults to the current origin, which is what the app
// needs while the API routes live under the same host at /api/auth.
export const authClient = createAuthClient();
