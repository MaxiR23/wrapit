// The production build must apply pending Prisma migrations before Next
// compiles. Skipping that step ships a client that selects columns the
// database does not have yet; authenticated pages that read Membership
// then 500 after sign-in.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package.json build', () => {
  it('applies pending migrations before next build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['db:deploy']).toBe('prisma migrate deploy');
    expect(pkg.scripts.build).toMatch(/prisma migrate deploy/);
    expect(pkg.scripts.build).toMatch(/prisma generate/);
    expect(pkg.scripts.build).toMatch(/next build/);
  });
});
