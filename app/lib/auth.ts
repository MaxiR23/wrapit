import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { prisma } from '@/app/lib/prisma';
import { MIN_PASSWORD_LENGTH } from '@/app/lib/validation/signUp';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    // Set explicitly so the server enforces the same minimum the sign up form
    // validates against.
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});
