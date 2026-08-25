// tests/lib/validation/subtask.test.ts
//
// Tests for the subtask field validation.
//
// Tested:
// - Reports an error when the text is empty
// - Rejects empty, whitespace, and oversized ids
//
// What is covered:
// - Invalid text, invalid ids
//
// Run with: pnpm test:run tests/lib/validation/subtask.test.ts
//
// SEE: src/lib/validation/subtask.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  createSubtaskSchema,
  deleteSubtaskSchema,
  updateSubtaskFieldSchema,
  validateCreateSubtask,
} from '@/lib/validation/subtask';

describe('validateCreateSubtask', () => {
  it('reports no errors for non-empty text', () => {
    expect(validateCreateSubtask({ cardId: 'card-1', text: 'First step' })).toEqual({});
  });

  it('reports an error when the text is empty', () => {
    expect(validateCreateSubtask({ cardId: 'card-1', text: '' }).text).toBe('Text is required');
    expect(validateCreateSubtask({ cardId: 'card-1', text: '   ' }).text).toBe('Text is required');
  });

  it('rejects empty, whitespace, and oversized card ids', () => {
    expect(validateCreateSubtask({ cardId: '', text: 'First step' }).cardId).toBeTruthy();
    expect(validateCreateSubtask({ cardId: '   ', text: 'First step' }).cardId).toBeTruthy();
    expect(
      validateCreateSubtask({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1), text: 'First step' }).cardId,
    ).toBeTruthy();
  });
});

describe('createSubtaskSchema', () => {
  it('rejects an empty text', () => {
    expect(createSubtaskSchema.safeParse({ cardId: 'card-1', text: '' }).success).toBe(false);
  });

  it('rejects an invalid card id', () => {
    expect(createSubtaskSchema.safeParse({ cardId: '', text: 'First step' }).success).toBe(false);
    expect(
      createSubtaskSchema.safeParse({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        text: 'First step',
      }).success,
    ).toBe(false);
  });
});

describe('updateSubtaskFieldSchema', () => {
  it('rejects empty text', () => {
    expect(
      updateSubtaskFieldSchema.safeParse({ subtaskId: 'sub-1', field: 'text', value: '' }).success,
    ).toBe(false);
    expect(
      updateSubtaskFieldSchema.safeParse({ subtaskId: 'sub-1', field: 'text', value: '   ' })
        .success,
    ).toBe(false);
  });

  it('rejects an invalid subtask id', () => {
    expect(
      updateSubtaskFieldSchema.safeParse({ subtaskId: '', field: 'text', value: 'Renamed' })
        .success,
    ).toBe(false);
    expect(
      updateSubtaskFieldSchema.safeParse({
        subtaskId: 'a'.repeat(MAX_ID_LENGTH + 1),
        field: 'done',
        value: true,
      }).success,
    ).toBe(false);
  });
});

describe('deleteSubtaskSchema', () => {
  it('rejects an invalid subtask id', () => {
    expect(deleteSubtaskSchema.safeParse({ subtaskId: '' }).success).toBe(false);
    expect(deleteSubtaskSchema.safeParse({ subtaskId: '   ' }).success).toBe(false);
    expect(
      deleteSubtaskSchema.safeParse({ subtaskId: 'a'.repeat(MAX_ID_LENGTH + 1) }).success,
    ).toBe(false);
  });
});
