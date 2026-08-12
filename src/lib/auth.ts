import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { sendResetPasswordEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { RESET_PASSWORD_PATH } from '@/lib/routes';
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
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = new URL(RESET_PASSWORD_PATH, process.env.BETTER_AUTH_URL);
      resetUrl.searchParams.set('token', token);
      await sendResetPasswordEmail(user.email, resetUrl.toString());
    },
  },
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});
