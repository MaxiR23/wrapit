// tests/app/radius.test.ts
//
// Tests for the shared radius scale and the ban on raw corner values.
//
// Tested:
// - globals.css defines explicit rem steps, not a multiplier ladder
// - Tab-bar inset, clearance, offset, and shadow tokens exist
// - src/components has no rounded-[...] unless the exact file:match is
//   listed in ALLOWED_ARBITRARY_RADII
// - Search inputs use type=text with role=searchbox; type=search is banned
//   because Safari's searchfield path ignores radius and padding
//
// What is covered:
// - Token presence and a source scan. jsdom cannot prove computed pixels
//   or the floating bar against a home indicator.
//
// Run with: pnpm test:run tests/app/radius.test.ts
//
// SEE: src/app/globals.css, docs/theming.md

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(resolve(repoRoot, 'src/app/globals.css'), 'utf8');
const componentsRoot = resolve(repoRoot, 'src/components');

const ARBITRARY_RADIUS = /rounded-(?:[trblse]{1,2}-)?\[[^\]]*\]/;
const SEARCH_INPUT = /<input\b[\s\S]*?\/>/g;

/**
 * Exact `relativePath:match` strings allowed to keep an arbitrary radius.
 * Keep this list short. A new raw value is a new string, so it fails until
 * it is replaced with a named step or added here on purpose.
 */
const ALLOWED_ARBITRARY_RADII: readonly string[] = [];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(tsx|ts|css)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

describe('radius scale', () => {
  it('matches any arbitrary radius, including values that are not in the tree today', () => {
    expect('rounded-[8px]'.match(ARBITRARY_RADIUS)?.[0]).toBe('rounded-[8px]');
    expect('rounded-t-[99px]'.match(ARBITRARY_RADIUS)?.[0]).toBe('rounded-t-[99px]');
    expect('rounded-[min(var(--radius-md),10px)]'.match(ARBITRARY_RADIUS)?.[0]).toBe(
      'rounded-[min(var(--radius-md),10px)]',
    );
    expect('rounded-md'.match(ARBITRARY_RADIUS)).toBeNull();
    expect('rounded-t-2xl'.match(ARBITRARY_RADIUS)).toBeNull();
    expect('rounded-full'.match(ARBITRARY_RADIUS)).toBeNull();
    expect('rounded-none'.match(ARBITRARY_RADIUS)).toBeNull();
  });
  it('defines explicit rem steps instead of a multiplier ladder', () => {
    expect(css).toMatch(/--radius-xs:\s*0\.375rem;/);
    expect(css).toMatch(/--radius-sm:\s*0\.5rem;/);
    expect(css).toMatch(/--radius:\s*0\.75rem;/);
    expect(css).toMatch(/--radius-md:\s*var\(--radius\);/);
    expect(css).toMatch(/--radius-lg:\s*1rem;/);
    expect(css).toMatch(/--radius-xl:\s*1\.25rem;/);
    expect(css).toMatch(/--radius-2xl:\s*1\.5rem;/);
    expect(css).toMatch(/--radius-3xl:\s*1\.75rem;/);
    expect(css).toMatch(/--radius-4xl:\s*2rem;/);
    expect(css).not.toMatch(/--radius-sm:\s*calc\(var\(--radius\)/);
  });

  it('defines tab-bar inset, clearance, offset, shadow, and searchfield reset', () => {
    expect(css).toMatch(/--spacing-mobile-tab-bar:\s*4rem;/);
    expect(css).toMatch(/--spacing-mobile-tab-bar-inset:\s*0\.75rem;/);
    expect(css).toMatch(
      /--spacing-mobile-tab-bar-clearance:\s*calc\(\s*var\(--spacing-mobile-tab-bar\) \+ var\(--spacing-mobile-tab-bar-inset\)\s*\)/,
    );
    expect(css).toMatch(
      /--spacing-mobile-tab-bar-offset:\s*calc\(\s*var\(--spacing-mobile-tab-bar-clearance\) \+ env\(safe-area-inset-bottom,\s*0px\)\s*\)/,
    );
    expect(css).toMatch(/--shadow-mobile-tab-bar:/);
    expect(css).toMatch(/--color-mobile-tab-bar:\s*var\(--mobile-tab-bar\);/);
    expect(css).toMatch(/--mobile-tab-bar:/);
    expect(css).toMatch(/input\[role='searchbox'\] \{\s*appearance:\s*none;/);
    expect(css).not.toMatch(/input\[role='searchbox'\] \{[^}]*border-radius:\s*0/);
  });

  it('treats appearance-none on a search input as a reset override', () => {
    const bad = '<input type="search" className="appearance-none rounded-md" />';
    const good = '<input type="search" className="rounded-md overflow-hidden" />';
    const other = '<input type="checkbox" className="appearance-none rounded-full" />';

    expect([...bad.matchAll(SEARCH_INPUT)].some((match) => /appearance-none/.test(match[0]))).toBe(
      true,
    );
    expect([...good.matchAll(SEARCH_INPUT)].some((match) => /appearance-none/.test(match[0]))).toBe(
      false,
    );
    expect(
      [...other.matchAll(SEARCH_INPUT)].some(
        (match) => /type=["']search["']/.test(match[0]) && /appearance-none/.test(match[0]),
      ),
    ).toBe(false);
  });

  it('does not ship CSS functions Safari evals as JavaScript', () => {
    expect(css).not.toMatch(/inset\s*\(/);
    expect(css).not.toMatch(/color-mix\s*\(/);

    const leftovers: string[] = [];
    for (const file of walk(componentsRoot)) {
      const source = readFileSync(file, 'utf8');
      if (/color-mix\s*\(/.test(source) || /inset\s*\(\s*0/.test(source)) {
        leftovers.push(relative(componentsRoot, file).replaceAll('\\', '/'));
      }
    }

    expect(leftovers).toEqual([]);
  });

  it('does not use type=search, which Safari cannot round', () => {
    const leftovers: string[] = [];

    for (const file of walk(componentsRoot)) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(componentsRoot, file).replaceAll('\\', '/');

      if (/type=["']search["']/.test(source)) {
        leftovers.push(rel);
      }
    }

    expect(leftovers).toEqual([]);
  });

  it('does not let appearance-none override the searchfield reset', () => {
    const leftovers: string[] = [];

    for (const file of walk(componentsRoot)) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(componentsRoot, file).replaceAll('\\', '/');

      for (const match of source.matchAll(SEARCH_INPUT)) {
        const tag = match[0];
        if (/type=["']search["']/.test(tag) && /\bappearance-none\b/.test(tag)) {
          leftovers.push(rel);
        }
      }
    }

    expect(leftovers).toEqual([]);
  });

  it('fails when a component sets a raw radius that is not on the allowlist', () => {
    const leftovers: string[] = [];

    for (const file of walk(componentsRoot)) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(componentsRoot, file).replaceAll('\\', '/');

      for (const match of source.matchAll(new RegExp(ARBITRARY_RADIUS, 'g'))) {
        const key = `${rel}:${match[0]}`;
        if (!ALLOWED_ARBITRARY_RADII.includes(key)) {
          leftovers.push(key);
        }
      }
    }

    expect(leftovers).toEqual([]);
  });
});
