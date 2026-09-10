import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ name: string, command: string, args: string[] }} VerifyStep
 */

export const VERIFY_STEPS = [
  { name: 'lint', command: 'pnpm', args: ['lint'] },
  { name: 'format:check', command: 'pnpm', args: ['format:check'] },
  { name: 'tsc --noEmit', command: 'pnpm', args: ['exec', 'tsc', '--noEmit'] },
  { name: 'test:run', command: 'pnpm', args: ['test:run'] },
  { name: 'build', command: 'pnpm', args: ['build'] },
];

/**
 * @param {{
 *   steps: VerifyStep[],
 *   run: (step: VerifyStep) => number | null | undefined,
 *   log?: (message: string) => void,
 * }} options
 * @returns {number}
 */
export function runVerify({ steps, run, log = console.log }) {
  const total = steps.length;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const remaining = steps.slice(i + 1).map((item) => item.name);
    log(`verify: [${i + 1}/${total}] ${step.name}`);

    let status;
    try {
      status = run(step);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`verify: failed at ${step.name}: ${message}`);
      if (remaining.length > 0) {
        log(`verify: never ran: ${remaining.join(', ')}`);
      }
      return 1;
    }

    if (status !== 0) {
      log(`verify: failed at ${step.name} (exit ${status ?? 1})`);
      if (remaining.length > 0) {
        log(`verify: never ran: ${remaining.join(', ')}`);
      }
      return typeof status === 'number' && status !== 0 ? status : 1;
    }

    log(`verify: passed ${step.name}`);
  }

  log('verify: all steps passed');
  return 0;
}

/**
 * @param {VerifyStep} step
 * @returns {number}
 */
export function runStep(step) {
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === null) {
    return 1;
  }

  return result.status;
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry);
}

if (isMain()) {
  process.exit(runVerify({ steps: VERIFY_STEPS, run: runStep }));
}
