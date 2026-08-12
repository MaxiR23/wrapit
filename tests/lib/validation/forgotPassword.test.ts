// tests/lib/validation/forgotPassword.test.ts
//
// Tests for the forgot-password field validation.
//
// Tested:
// - Reports no errors for a valid email
// - Reports an error when the email format is invalid
// - Reports an error when the email is empty
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/forgotPassword.test.ts
//
// SEE: src/lib/validation/forgotPassword.ts

import { describe, it, expect } from 'vitest';

import { validateForgotPassword } from '@/lib/validation/forgotPassword';

describe('validateForgotPassword', () => {
  it('reports no errors for a valid email', () => {
    expect(validateForgotPassword({ email: 'ada@example.com' })).toEqual({});
  });

  it('reports an error when the email format is invalid', () => {
    expect(validateForgotPassword({ email: 'ada@' }).email).toBe('Enter a valid email address');
  });

  it('reports an error when the email is empty', () => {
    expect(validateForgotPassword({ email: '' }).email).toBe('Enter a valid email address');
  });
});
