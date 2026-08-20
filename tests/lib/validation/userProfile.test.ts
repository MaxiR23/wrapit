// tests/lib/validation/userProfile.test.ts
//
// Tests for profile field and visibility validation.
//
// Tested:
// - Accepts a known value field with a trimmed string
// - Rejects an empty public name
// - Rejects an unknown field or visibility
// - Caps workingWithYou longer than other fields
//
// What is covered:
// - Happy path, invalid input, public name required, length bounds
//
// Run with: pnpm test:run tests/lib/validation/userProfile.test.ts
//
// SEE: src/lib/validation/userProfile.ts

import { describe, it, expect } from 'vitest';

import {
  MAX_PROFILE_FIELD_LENGTH,
  MAX_WORKING_WITH_YOU_LENGTH,
  validateUpdateProfileField,
  validateUpdateProfileVisibility,
} from '@/lib/validation/userProfile';

describe('validateUpdateProfileField', () => {
  it('reports no errors for a known field and value', () => {
    expect(validateUpdateProfileField({ field: 'pronouns', value: 'she/her' })).toEqual({});
    expect(validateUpdateProfileField({ field: 'publicName', value: ' Ada ' })).toEqual({});
  });

  it('reports an error when the public name is empty', () => {
    expect(validateUpdateProfileField({ field: 'publicName', value: '   ' }).value).toBeTruthy();
  });

  it('reports an error when the field is unknown', () => {
    expect(
      validateUpdateProfileField({ field: 'email', value: 'a@b.c' } as never).field,
    ).toBeTruthy();
  });

  it('rejects values longer than the field cap', () => {
    expect(
      validateUpdateProfileField({
        field: 'fullName',
        value: 'a'.repeat(MAX_PROFILE_FIELD_LENGTH + 1),
      }).value,
    ).toBeTruthy();
    expect(
      validateUpdateProfileField({
        field: 'workingWithYou',
        value: 'a'.repeat(MAX_WORKING_WITH_YOU_LENGTH),
      }),
    ).toEqual({});
  });
});

describe('validateUpdateProfileVisibility', () => {
  it('reports no errors for a known field and visibility', () => {
    expect(validateUpdateProfileVisibility({ field: 'email', visibility: 'admins' })).toEqual({});
    expect(validateUpdateProfileVisibility({ field: 'photo', visibility: 'anyone' })).toEqual({});
    expect(validateUpdateProfileVisibility({ field: 'localTime', visibility: 'team' })).toEqual({});
  });

  it('reports an error when the visibility is unknown', () => {
    expect(
      validateUpdateProfileVisibility({ field: 'email', visibility: 'secret' } as never).visibility,
    ).toBeTruthy();
  });
});
