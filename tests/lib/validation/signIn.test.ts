// tests/lib/validation/signIn.test.ts
//
// Tests for the sign in field validation.
//
// Tested:
// - Reports no errors for valid input
// - Reports an error when the email format is invalid
// - Reports an error when the email is empty
// - Reports an error when the password is empty
// - Accepts a password shorter than the sign up minimum
// - Reports an error on every field when all of them are empty
//
// What is covered:
// - Happy path, invalid input, edge cases
//
// Run with: pnpm test:run tests/lib/validation/signIn.test.ts
//
// SEE: src/lib/validation/signIn.ts

import { describe, it, expect } from 'vitest';

import { validateSignIn } from '@/lib/validation/signIn';

const validInput = {
  email: 'ada@example.com',
  password: 'a-long-enough-password',
};

describe('validateSignIn', () => {
  it('reports no errors for valid input', () => {
    expect(validateSignIn(validInput)).toEqual({});
  });

  it('reports an error when the email format is invalid', () => {
    const errors = validateSignIn({ ...validInput, email: 'ada@' });

    expect(errors.email).toBe('Enter a valid email address');
    expect(errors.password).toBeUndefined();
  });

  it('reports an error when the email is empty', () => {
    expect(validateSignIn({ ...validInput, email: '' }).email).toBe('Enter a valid email address');
  });

  it('reports an error when the password is empty', () => {
    const errors = validateSignIn({ ...validInput, password: '' });

    expect(errors.password).toBe('Password is required');
    expect(errors.email).toBeUndefined();
  });

  it('accepts a password shorter than the sign up minimum', () => {
    // Sign in only checks that a password was typed. Length is the server's
    // call, and an account created before a length change must still be able
    // to sign in.
    expect(validateSignIn({ ...validInput, password: 'a' })).toEqual({});
  });

  it('reports an error on every field when all of them are empty', () => {
    const errors = validateSignIn({ email: '', password: '' });

    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});
