// tests/lib/skipEmailVerification.test.ts
//
// Tests for the SKIP_EMAIL_VERIFICATION env predicate.
//
// Tested:
// - Only the exact string "true" disables verification
// - Absent, empty, and other values leave verification on
//
// What is covered:
// - Happy path, the safe default, typos and truthy lookalikes
//
// Run with: pnpm test:run tests/lib/skipEmailVerification.test.ts
//
// SEE: src/lib/skipEmailVerification.ts

import { describe, it, expect } from 'vitest';

import { isSkipEmailVerificationEnabled } from '@/lib/skipEmailVerification';

describe('isSkipEmailVerificationEnabled', () => {
  it('is on only for the exact string "true"', () => {
    expect(isSkipEmailVerificationEnabled('true')).toBe(true);
  });

  it('is off when the value is absent', () => {
    expect(isSkipEmailVerificationEnabled(undefined)).toBe(false);
  });

  it('is off for empty, false, and truthy lookalikes', () => {
    expect(isSkipEmailVerificationEnabled('')).toBe(false);
    expect(isSkipEmailVerificationEnabled('false')).toBe(false);
    expect(isSkipEmailVerificationEnabled('TRUE')).toBe(false);
    expect(isSkipEmailVerificationEnabled('1')).toBe(false);
  });
});
