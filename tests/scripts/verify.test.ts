// tests/scripts/verify.test.ts
//
// Tests for the pnpm verify gate.
//
// Tested:
// - package.json wires verify to the runner
// - steps run in the required order
// - first failure stops the rest and names what never ran
// - an environment error is a failure, not a skip
// - the husky pre-push hook verifies only a clean checked-out HEAD
// - the hook runs the clean-HEAD guard before requiring pnpm
//
// What is covered:
// - Happy path, first-step failure, mid-step failure, thrown run error,
//   pre-push guard order
//
// Run with: pnpm test:run tests/scripts/verify.test.ts
//
// SEE: scripts/verify.mjs

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

import { VERIFY_STEPS, runVerify } from '../../scripts/verify.mjs';

describe('pnpm verify', () => {
  it('is wired as a package.json script that runs the verify runner', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.verify).toBe('node scripts/verify.mjs');
  });

  it('runs lint, format:check, tsc --noEmit, test:run, then build', () => {
    expect(VERIFY_STEPS.map((step) => step.name)).toEqual([
      'lint',
      'format:check',
      'tsc --noEmit',
      'test:run',
      'build',
    ]);
    expect(VERIFY_STEPS.map((step) => [step.command, ...step.args])).toEqual([
      ['pnpm', 'lint'],
      ['pnpm', 'format:check'],
      ['pnpm', 'exec', 'tsc', '--noEmit'],
      ['pnpm', 'test:run'],
      ['pnpm', 'build'],
    ]);
  });

  it('stops at the first failure and reports steps that never ran', () => {
    const run = vi.fn((step: { name: string }) => (step.name === 'format:check' ? 2 : 0));
    const lines: string[] = [];

    const code = runVerify({
      steps: VERIFY_STEPS,
      run,
      log: (message: string) => {
        lines.push(message);
      },
    });

    expect(code).toBe(2);
    expect(run.mock.calls.map((call) => call[0].name)).toEqual(['lint', 'format:check']);
    expect(lines.some((line) => line.includes('failed at format:check'))).toBe(true);
    expect(lines.some((line) => line.includes('never ran: tsc --noEmit, test:run, build'))).toBe(
      true,
    );
  });

  it('treats a thrown environment error as a failure and does not skip', () => {
    const run = vi.fn((step: { name: string }) => {
      if (step.name === 'build') {
        throw new Error('database is unavailable');
      }
      return 0;
    });
    const lines: string[] = [];

    const code = runVerify({
      steps: VERIFY_STEPS,
      run,
      log: (message: string) => {
        lines.push(message);
      },
    });

    expect(code).not.toBe(0);
    expect(run).toHaveBeenCalledTimes(5);
    expect(lines.some((line) => line.includes('failed at build'))).toBe(true);
    expect(lines.some((line) => line.includes('never ran'))).toBe(false);
  });

  it('returns zero when every step passes', () => {
    const run = vi.fn(() => 0);
    const lines: string[] = [];

    const code = runVerify({
      steps: VERIFY_STEPS,
      run,
      log: (message: string) => {
        lines.push(message);
      },
    });

    expect(code).toBe(0);
    expect(run).toHaveBeenCalledTimes(5);
    expect(lines.at(-1)).toBe('verify: all steps passed');
  });

  it('has a husky pre-push hook that verifies only a clean checked-out HEAD', () => {
    const hook = readFileSync('.husky/pre-push', 'utf8');

    expect(hook).toMatch(/assert-pushing-clean-head\.sh/);
    expect(hook).toMatch(/pnpm verify/);
  });

  it('runs the clean-HEAD guard before requiring pnpm', () => {
    const hook = readFileSync('.husky/pre-push', 'utf8');
    const guardAt = hook.indexOf('assert-pushing-clean-head.sh');
    const pnpmRequiredAt = hook.indexOf('pnpm was not found in PATH');

    expect(guardAt).toBeGreaterThan(-1);
    expect(pnpmRequiredAt).toBeGreaterThan(guardAt);
  });

  it('allows a delete-only push when pnpm is not on PATH', () => {
    const zero = '0'.repeat(40);
    const result = spawnSync('sh', ['.husky/pre-push'], {
      encoding: 'utf8',
      input: `refs/heads/gone ${zero} refs/heads/gone ${zero}\n`,
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin',
        NVM_DIR: '/dev/null',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toMatch(/pnpm was not found/);
  });
});
