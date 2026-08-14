import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import type { auth } from '@/lib/auth';

// No baseURL: the client defaults to the current origin, which is what the app
// needs while the API routes live under the same host at /api/auth.
// inferAdditionalFields keeps signUp.email typed with the server's username field.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
