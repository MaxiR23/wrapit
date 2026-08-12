import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { prisma } from '@/lib/prisma';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/signUp';

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
  // additionalFields (not the username plugin): our Prisma User has required
  // unique `username` and no `displayUsername`, which the username plugin would
  // try to write. Sign-up accepts `username` and persists it on the User row.
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        unique: true,
      },
    },
  },
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});
