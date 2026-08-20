// tests/lib/validation/userStatus.test.ts
//
// Tests for user-status action validation.
//
// Tested:
// - Accepts a bounded status id
// - Rejects empty, whitespace, and oversized ids before any other check
// - Requires a trimmed name on create and on name edits
// - Allows an empty description
// - Rejects an unknown color or field
//
// What is covered:
// - Happy path, invalid input, name required, color enum, length bounds
//
// Run with: pnpm test:run tests/lib/validation/userStatus.test.ts
//
// SEE: src/lib/validation/userStatus.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  MAX_USER_STATUS_FIELD_LENGTH,
  validateCreateUserStatus,
  validateDeleteUserStatus,
  validateSetActiveStatus,
  validateUpdateUserStatusField,
} from '@/lib/validation/userStatus';

describe('validateSetActiveStatus', () => {
  it('accepts a bounded status id', () => {
    expect(validateSetActiveStatus({ statusId: 'status-1' })).toEqual({});
  });

  it('rejects empty, whitespace, and oversized ids', () => {
    expect(validateSetActiveStatus({ statusId: '' }).statusId).toBeTruthy();
    expect(validateSetActiveStatus({ statusId: '   ' }).statusId).toBeTruthy();
    expect(
      validateSetActiveStatus({ statusId: 'a'.repeat(MAX_ID_LENGTH + 1) }).statusId,
    ).toBeTruthy();
  });
});

describe('validateDeleteUserStatus', () => {
  it('rejects an empty status id', () => {
    expect(validateDeleteUserStatus({ statusId: '' }).statusId).toBeTruthy();
  });
});

describe('validateCreateUserStatus', () => {
  it('accepts a trimmed name', () => {
    expect(validateCreateUserStatus({ name: ' Focus ' })).toEqual({});
  });

  it('rejects an empty name and an oversized name', () => {
    expect(validateCreateUserStatus({ name: '   ' }).name).toBeTruthy();
    expect(
      validateCreateUserStatus({ name: 'a'.repeat(MAX_USER_STATUS_FIELD_LENGTH + 1) }).name,
    ).toBeTruthy();
  });
});

describe('validateUpdateUserStatusField', () => {
  it('accepts name, description, and color writes', () => {
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'name', value: 'Focus' }),
    ).toEqual({});
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'description', value: '' }),
    ).toEqual({});
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'color', value: 'blue' }),
    ).toEqual({});
  });

  it('rejects an empty name and an unknown color or field', () => {
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'name', value: '   ' }).value,
    ).toBeTruthy();
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'color', value: 'pink' }).value,
    ).toBeTruthy();
    expect(
      validateUpdateUserStatusField({ statusId: 's1', field: 'tone', value: 'green' } as never)
        .field,
    ).toBeTruthy();
  });
});
