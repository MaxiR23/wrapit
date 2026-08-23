// tests/lib/validation/label.test.ts
//
// Tests for project-label action validation.
//
// Tested:
// - Accepts a bounded project or label id
// - Rejects empty, whitespace, and oversized ids before any other check
// - Requires a trimmed name on name edits
// - Rejects an unknown tone or field
//
// What is covered:
// - Happy path, invalid input, name required, tone enum, length bounds
//
// Run with: pnpm test:run tests/lib/validation/label.test.ts
//
// SEE: src/lib/validation/label.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  MAX_LABEL_FIELD_LENGTH,
  validateCreateLabel,
  validateDeleteLabel,
  validateUpdateLabelField,
} from '@/lib/validation/label';

describe('validateCreateLabel', () => {
  it('accepts a bounded project id', () => {
    expect(validateCreateLabel({ projectId: 'project-1' })).toEqual({});
  });

  it('rejects empty, whitespace, and oversized ids', () => {
    expect(validateCreateLabel({ projectId: '' }).projectId).toBeTruthy();
    expect(validateCreateLabel({ projectId: '   ' }).projectId).toBeTruthy();
    expect(
      validateCreateLabel({ projectId: 'a'.repeat(MAX_ID_LENGTH + 1) }).projectId,
    ).toBeTruthy();
  });
});

describe('validateDeleteLabel', () => {
  it('rejects an empty label id', () => {
    expect(validateDeleteLabel({ labelId: '' }).labelId).toBeTruthy();
  });
});

describe('validateUpdateLabelField', () => {
  it('accepts name and tone writes', () => {
    expect(validateUpdateLabelField({ labelId: 'l1', field: 'name', value: 'Design' })).toEqual({});
    expect(validateUpdateLabelField({ labelId: 'l1', field: 'tone', value: 'pink' })).toEqual({});
  });

  it('rejects an empty name and an unknown tone or field', () => {
    expect(
      validateUpdateLabelField({ labelId: 'l1', field: 'name', value: '   ' }).value,
    ).toBeTruthy();
    expect(
      validateUpdateLabelField({
        labelId: 'l1',
        field: 'name',
        value: 'a'.repeat(MAX_LABEL_FIELD_LENGTH + 1),
      }).value,
    ).toBeTruthy();
    expect(
      validateUpdateLabelField({ labelId: 'l1', field: 'tone', value: 'secret' }).value,
    ).toBeTruthy();
    expect(
      validateUpdateLabelField({ labelId: 'l1', field: 'color', value: 'blue' } as never).field,
    ).toBeTruthy();
  });
});
