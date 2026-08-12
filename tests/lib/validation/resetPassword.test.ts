// tests/lib/validation/resetPassword.test.ts
//
// Tests for the reset-password field validation.
//
// Tested:
// - Reports no errors when password and confirmPassword match and meet the minimum
// - Reports an error when the password is shorter than the sign-up minimum
// - Reports an error on confirmPassword when the two passwords do not match
// - Reports an error on every field when both are empty
//
// What is covered:
// - Happy path, invalid input, confirmPassword mismatch
//
// Run with: pnpm test:run tests/lib/validation/resetPassword.test.ts
//
// SEE: src/lib/validation/resetPassword.ts

import { describe, it, expect } from 'vitest';

import { MIN_PASSWORD_LENGTH } from '@/lib/validation/signUp';
import { validateResetPassword } from '@/lib/validation/resetPassword';

const validInput = {
  password: 'a-long-enough-password',
  confirmPassword: 'a-long-enough-password',
};

describe('validateResetPassword', () => {
  it('reports no errors when the passwords match and meet the minimum', () => {
    expect(validateResetPassword(validInput)).toEqual({});
  });

  it('accepts a password of exactly the minimum length when both fields match', () => {
    const password = 'a'.repeat(MIN_PASSWORD_LENGTH);

    expect(validateResetPassword({ password, confirmPassword: password })).toEqual({});
  });

  it('reports an error when the password is one character short of the minimum', () => {
    const password = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const errors = validateResetPassword({ password, confirmPassword: password });

    expect(errors.password).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it('reports an error on confirmPassword when the two passwords do not match', () => {
    const errors = validateResetPassword({
      ...validInput,
      confirmPassword: 'a-different-password',
    });

    expect(errors.confirmPassword).toBe('Passwords do not match');
    expect(errors.password).toBeUndefined();
  });

  it('reports an error on every field when both are empty', () => {
    const errors = validateResetPassword({ password: '', confirmPassword: '' });

    expect(errors.password).toBeDefined();
    expect(errors.confirmPassword).toBeDefined();
  });
});
