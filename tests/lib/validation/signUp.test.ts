// tests/lib/validation/signUp.test.ts
//
// Tests for the sign up field validation.
//
// Tested:
// - Reports no errors for valid input
// - Reports an error when the name is empty or only whitespace
// - Reports an error when the email format is invalid
// - Reports an error when the password is shorter than the minimum
// - Reports an error on every field when all of them are empty
//
// What is covered:
// - Happy path, invalid input, edge cases
//
// Run with: pnpm test:run tests/lib/validation/signUp.test.ts
//
// SEE: app/lib/validation/signUp.ts

import { describe, it, expect } from 'vitest';

import { MIN_PASSWORD_LENGTH, validateSignUp } from '@/app/lib/validation/signUp';

const validInput = {
  name: 'Ada',
  email: 'ada@example.com',
  password: 'a-long-enough-password',
};

describe('validateSignUp', () => {
  it('reports no errors for valid input', () => {
    expect(validateSignUp(validInput)).toEqual({});
  });

  it('reports an error when the name is empty', () => {
    const errors = validateSignUp({ ...validInput, name: '' });

    expect(errors.name).toBe('Name is required');
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
  });

  it('reports an error when the name is only whitespace', () => {
    expect(validateSignUp({ ...validInput, name: '   ' }).name).toBe('Name is required');
  });

  it('reports an error when the email format is invalid', () => {
    const errors = validateSignUp({ ...validInput, email: 'ada@' });

    expect(errors.email).toBe('Enter a valid email address');
    expect(errors.name).toBeUndefined();
  });

  it('reports an error when the email is empty', () => {
    expect(validateSignUp({ ...validInput, email: '' }).email).toBe('Enter a valid email address');
  });

  it('reports an error when the password is one character short of the minimum', () => {
    const errors = validateSignUp({
      ...validInput,
      password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    });

    expect(errors.password).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it('accepts a password of exactly the minimum length', () => {
    const errors = validateSignUp({
      ...validInput,
      password: 'a'.repeat(MIN_PASSWORD_LENGTH),
    });

    expect(errors).toEqual({});
  });

  it('reports an error on every field when all of them are empty', () => {
    const errors = validateSignUp({ name: '', email: '', password: '' });

    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});
