// tests/build-migrations-split.test.ts
//
// Tests for the local-vs-Vercel migration split.
//
// Tested:
// - package.json build does not run prisma migrate deploy
// - package.json build runs prisma generate then next build
// - db:deploy is prisma migrate deploy
// - vercel.json buildCommand runs db:deploy before build
//
// What is covered:
// - The production migrate step lives on Vercel, not in pnpm build
//
// Run with: pnpm test:run tests/build-migrations-split.test.ts
//
// SEE: package.json, vercel.json

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build migrations split', () => {
  it('keeps migrate deploy off the local build and on the Vercel build command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      buildCommand: string;
    };

    expect(pkg.scripts.build).not.toMatch(/prisma migrate deploy/);
    expect(pkg.scripts.build).toMatch(/prisma generate/);
    expect(pkg.scripts.build).toMatch(/next build/);
    expect(pkg.scripts.build.indexOf('prisma generate')).toBeLessThan(
      pkg.scripts.build.indexOf('next build'),
    );
    expect(pkg.scripts['db:deploy']).toBe('prisma migrate deploy');
    expect(vercel.buildCommand).toBe('pnpm db:deploy && pnpm build');
  });
});
