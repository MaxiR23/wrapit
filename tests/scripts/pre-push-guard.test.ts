// tests/scripts/pre-push-guard.test.ts
//
// Tests for the pre-push clean-HEAD guard.
//
// Tested:
// - Pushing HEAD with a dirty tree is refused
// - Pushing HEAD with an untracked file is refused
// - Pushing a SHA that is not HEAD is refused
// - An annotated tag that peels to HEAD is allowed
// - An annotated tag that peels to another commit is refused
// - Pushing a clean checked-out HEAD is allowed
// - A delete-only push is allowed without verify
// - A push line without a trailing newline is still read
//
// What is covered:
// - Dirty tree, untracked file, wrong ref, tag on HEAD, tag on another commit,
//   happy path, delete-only, missing newline
//
// Run with: pnpm test:run tests/scripts/pre-push-guard.test.ts
//
// SEE: scripts/assert-pushing-clean-head.sh

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const guardPath = path.join(process.cwd(), 'scripts/assert-pushing-clean-head.sh');
const zero = '0'.repeat(40);
const head = 'b'.repeat(40);
const otherCommit = 'a'.repeat(40);
const tagOnHead = 'c'.repeat(40);
const tagOnOther = 'd'.repeat(40);
const temps: string[] = [];

afterEach(() => {
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function pushLine(ref: string, sha: string) {
  return `${ref} ${sha} ${ref} ${zero}\n`;
}

function runGuard({
  porcelain,
  stdin,
  peel = '',
}: {
  porcelain: string;
  stdin: string;
  peel?: string;
}) {
  const bin = mkdtempSync(path.join(process.cwd(), 'tests', '.tmp-pre-push-'));
  temps.push(bin);
  const gitPath = path.join(bin, 'git');
  writeFileSync(
    gitPath,
    [
      '#!/bin/sh',
      'if [ "$1" = "status" ]; then printf "%s" "$FAKE_STATUS"; exit 0; fi',
      'if [ "$1" != "rev-parse" ]; then exit 1; fi',
      'arg="$2"',
      'if [ "$arg" = "HEAD" ]; then printf "%s\\n" "$FAKE_HEAD"; exit 0; fi',
      'sha=$arg',
      'case "$arg" in',
      '*^{commit}) sha=${arg%"^{commit}"} ;;',
      'esac',
      'IFS=,',
      'for pair in $FAKE_PEEL; do',
      '  from=${pair%%:*}',
      '  to=${pair#*:}',
      '  if [ "$from" = "$sha" ]; then printf "%s\\n" "$to"; exit 0; fi',
      'done',
      'printf "%s\\n" "$sha"',
      'exit 0',
      '',
    ].join('\n'),
  );
  chmodSync(gitPath, 0o755);

  return spawnSync('sh', [guardPath], {
    encoding: 'utf8',
    input: stdin,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_HEAD: head,
      FAKE_STATUS: porcelain,
      FAKE_PEEL: peel,
    },
  });
}

describe('pre-push clean-HEAD guard', () => {
  it('refuses pushing HEAD when the working tree has uncommitted edits', () => {
    const result = runGuard({
      porcelain: ' M file.txt\n',
      stdin: pushLine('refs/heads/main', head),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/working tree is not clean/);
  });

  it('refuses pushing HEAD when an untracked file is present', () => {
    const result = runGuard({
      porcelain: '?? fix.ts\n',
      stdin: pushLine('refs/heads/main', head),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/working tree is not clean/);
  });

  it('refuses pushing a SHA that is not the checked-out HEAD', () => {
    const result = runGuard({
      porcelain: '',
      stdin: pushLine('refs/heads/other', otherCommit),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/is not the checked-out HEAD/);
  });

  it('allows an annotated tag that peels to HEAD', () => {
    const result = runGuard({
      porcelain: '',
      stdin: pushLine('refs/tags/v1', tagOnHead),
      peel: `${tagOnHead}:${head}`,
    });

    expect(result.status).toBe(0);
  });

  it('refuses an annotated tag that peels to another commit', () => {
    const result = runGuard({
      porcelain: '',
      stdin: pushLine('refs/tags/v-other', tagOnOther),
      peel: `${tagOnOther}:${otherCommit}`,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/is not the checked-out HEAD/);
  });

  it('allows pushing the clean checked-out HEAD', () => {
    const result = runGuard({
      porcelain: '',
      stdin: pushLine('refs/heads/main', head),
    });

    expect(result.status).toBe(0);
  });

  it('allows a delete-only push without requiring a clean tree', () => {
    const result = runGuard({
      porcelain: ' M file.txt\n',
      stdin: pushLine('refs/heads/gone', zero),
    });

    expect(result.status).toBe(2);
  });

  it('still reads a push line that has no trailing newline', () => {
    const result = runGuard({
      porcelain: '',
      stdin: `refs/heads/main ${head} refs/heads/main ${zero}`,
    });

    expect(result.status).toBe(0);
  });
});
