// tests/lib/validation/comment.test.ts
//
// Tests for the comment field validation.
//
// Tested:
// - Reports an error when the body is empty
// - Rejects empty, whitespace, and oversized card ids
//
// What is covered:
// - Invalid body, invalid ids
//
// Run with: pnpm test:run tests/lib/validation/comment.test.ts
//
// SEE: src/lib/validation/comment.ts

import { describe, it, expect } from 'vitest';

import { MAX_ID_LENGTH } from '@/lib/validation/id';
import {
  createCommentSchema,
  updateCommentSchema,
  validateCreateComment,
  validateUpdateComment,
} from '@/lib/validation/comment';

describe('validateCreateComment', () => {
  it('reports no errors for a non-empty body', () => {
    expect(validateCreateComment({ cardId: 'card-1', body: 'Looks good' })).toEqual({});
  });

  it('reports an error when the body is empty', () => {
    expect(validateCreateComment({ cardId: 'card-1', body: '' }).body).toBe('Comment is required');
    expect(validateCreateComment({ cardId: 'card-1', body: '   ' }).body).toBe(
      'Comment is required',
    );
  });

  it('rejects empty, whitespace, and oversized card ids', () => {
    expect(validateCreateComment({ cardId: '', body: 'Looks good' }).cardId).toBeTruthy();
    expect(validateCreateComment({ cardId: '   ', body: 'Looks good' }).cardId).toBeTruthy();
    expect(
      validateCreateComment({ cardId: 'a'.repeat(MAX_ID_LENGTH + 1), body: 'Looks good' }).cardId,
    ).toBeTruthy();
  });
});

describe('createCommentSchema', () => {
  it('rejects an empty body', () => {
    expect(createCommentSchema.safeParse({ cardId: 'card-1', body: '' }).success).toBe(false);
  });

  it('rejects an invalid card id', () => {
    expect(createCommentSchema.safeParse({ cardId: '', body: 'Looks good' }).success).toBe(false);
    expect(
      createCommentSchema.safeParse({
        cardId: 'a'.repeat(MAX_ID_LENGTH + 1),
        body: 'Looks good',
      }).success,
    ).toBe(false);
  });
});

describe('validateUpdateComment', () => {
  it('reports no errors for a non-empty body', () => {
    expect(validateUpdateComment({ commentId: 'comment-1', body: 'Looks good' })).toEqual({});
  });

  it('reports an error when the body is empty or whitespace', () => {
    expect(validateUpdateComment({ commentId: 'comment-1', body: '' }).body).toBe(
      'Comment is required',
    );
    expect(validateUpdateComment({ commentId: 'comment-1', body: '   ' }).body).toBe(
      'Comment is required',
    );
  });
});

describe('updateCommentSchema', () => {
  it('reuses the create body rules', () => {
    expect(updateCommentSchema.safeParse({ commentId: 'comment-1', body: '' }).success).toBe(false);
    expect(updateCommentSchema.safeParse({ commentId: 'comment-1', body: '   ' }).success).toBe(
      false,
    );
    expect(
      updateCommentSchema.safeParse({ commentId: 'comment-1', body: 'Looks **good**' }).success,
    ).toBe(true);
  });

  it('rejects an invalid comment id', () => {
    expect(updateCommentSchema.safeParse({ commentId: '', body: 'Looks good' }).success).toBe(
      false,
    );
    expect(
      updateCommentSchema.safeParse({
        commentId: 'a'.repeat(MAX_ID_LENGTH + 1),
        body: 'Looks good',
      }).success,
    ).toBe(false);
  });
});
