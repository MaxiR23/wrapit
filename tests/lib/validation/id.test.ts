// tests/lib/validation/id.test.ts
//
// Tests for the shared bounded identifier schema.
//
// Tested:
// - Accepts a trimmed non-empty id within the length bound
// - Rejects empty, whitespace-only, oversized, and non-string values
//
// What is covered:
// - Happy path, invalid input
//
// Run with: pnpm test:run tests/lib/validation/id.test.ts
//
// SEE: src/lib/validation/id.ts

import { describe, it, expect } from 'vitest';

import { idSchema, MAX_ID_LENGTH } from '@/lib/validation/id';

describe('idSchema', () => {
  it('accepts a trimmed non-empty id within the bound', () => {
    expect(idSchema.parse('invite-1')).toBe('invite-1');
    expect(idSchema.parse('  invite-1  ')).toBe('invite-1');
    expect(idSchema.parse('a'.repeat(MAX_ID_LENGTH))).toHaveLength(MAX_ID_LENGTH);
  });

  it('rejects empty, whitespace-only, oversized, and non-string values', () => {
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse('   ').success).toBe(false);
    expect(idSchema.safeParse('a'.repeat(MAX_ID_LENGTH + 1)).success).toBe(false);
    expect(idSchema.safeParse(1).success).toBe(false);
  });
});
