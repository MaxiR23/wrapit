import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { sendResetPasswordEmail, sendVerificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { RESET_PASSWORD_PATH } from '@/lib/routes';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/signUp';

/** Verification JWT lifetime. Better Auth `expiresIn` is seconds; 24 hours. */
const EMAIL_VERIFICATION_EXPIRES_IN = 86400;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    // Set explicitly so the server enforces the same minimum the sign up form
    // validates against.
    minPasswordLength: MIN_PASSWORD_LENGTH,
    requireEmailVerification: true,
    // Duplicate-email sign-up returns this shape instead of 422, so the JSON
    // still includes `username` and cannot be told apart from a real create.
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      ...additionalFields,
      id,
    }),
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = new URL(RESET_PASSWORD_PATH, process.env.BETTER_AUTH_URL);
      resetUrl.searchParams.set('token', token);
      await sendResetPasswordEmail(user.email, resetUrl.toString());
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Unverified sign-in is 403 with an explicit resend on the form. Mailing
    // on every password-correct attempt would be extra mail for little gain.
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendVerificationEmail(user.email, url);
      } catch {
        // Swallow so a Resend failure cannot distinguish a real unverified
        // address from an unknown one. The helper already logged the cause.
      }
    },
  },
  // customRules apply in production. Rate limiting is off in development and
  // in Vitest (NODE_ENV is not production) unless a test stubs it on.
  rateLimit: {
    customRules: {
      '/send-verification-email': {
        window: 60,
        max: 3,
      },
      '/sign-in/email': {
        window: 60,
        max: 5,
      },
    },
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
