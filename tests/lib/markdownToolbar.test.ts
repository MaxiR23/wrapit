// tests/lib/markdownToolbar.test.ts
//
// Tests for wrapping a textarea selection with markdown markers.
//
// Tested:
// - Each action wraps a selection
// - Each action inserts markers when the selection is empty
// - A list prefixes every selected line and skips lines that are already items
//
// What is covered:
// - Wrap, empty insert, multi-line list
//
// Run with: pnpm test:run tests/lib/markdownToolbar.test.ts
//
// SEE: src/lib/markdownToolbar.ts

import { describe, it, expect } from 'vitest';

import { applyMarkdown } from '@/lib/markdownToolbar';

describe('applyMarkdown', () => {
  it('wraps a selection in bold and places the caret after it', () => {
    expect(
      applyMarkdown({ value: 'say foo now', selectionStart: 4, selectionEnd: 7 }, 'bold'),
    ).toEqual({
      value: 'say **foo** now',
      selectionStart: 11,
      selectionEnd: 11,
    });
  });

  it('inserts bold markers and places the caret between them when nothing is selected', () => {
    expect(
      applyMarkdown({ value: 'say  now', selectionStart: 4, selectionEnd: 4 }, 'bold'),
    ).toEqual({
      value: 'say **** now',
      selectionStart: 6,
      selectionEnd: 6,
    });
  });

  it('wraps a selection in italic', () => {
    expect(applyMarkdown({ value: 'foo', selectionStart: 0, selectionEnd: 3 }, 'italic')).toEqual({
      value: '*foo*',
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it('inserts italic markers around an empty selection', () => {
    expect(applyMarkdown({ value: '', selectionStart: 0, selectionEnd: 0 }, 'italic')).toEqual({
      value: '**',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it('wraps a selection in inline code', () => {
    expect(
      applyMarkdown({ value: 'pnpm test', selectionStart: 5, selectionEnd: 9 }, 'code'),
    ).toEqual({
      value: 'pnpm `test`',
      selectionStart: 11,
      selectionEnd: 11,
    });
  });

  it('inserts inline-code backticks around an empty selection', () => {
    expect(applyMarkdown({ value: '', selectionStart: 0, selectionEnd: 0 }, 'code')).toEqual({
      value: '``',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it('puts a selection on its own lines inside a fence', () => {
    expect(
      applyMarkdown({ value: 'say hello now', selectionStart: 4, selectionEnd: 9 }, 'codeBlock'),
    ).toEqual({
      value: 'say \n```\nhello\n```\n now',
      selectionStart: 19,
      selectionEnd: 19,
    });
  });

  it('inserts an empty fence and places the caret on the blank line inside', () => {
    expect(applyMarkdown({ value: '', selectionStart: 0, selectionEnd: 0 }, 'codeBlock')).toEqual({
      value: '```\n\n```',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it('wraps a selection as a link and selects the url placeholder', () => {
    expect(applyMarkdown({ value: 'foo', selectionStart: 0, selectionEnd: 3 }, 'link')).toEqual({
      value: '[foo](url)',
      selectionStart: 6,
      selectionEnd: 9,
    });
  });

  it('inserts an empty link and places the caret in the label', () => {
    expect(applyMarkdown({ value: '', selectionStart: 0, selectionEnd: 0 }, 'link')).toEqual({
      value: '[](url)',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it('prefixes each selected line with a list marker', () => {
    expect(
      applyMarkdown({ value: 'one\ntwo', selectionStart: 0, selectionEnd: 7 }, 'list'),
    ).toEqual({
      value: '- one\n- two',
      selectionStart: 0,
      selectionEnd: 11,
    });
  });

  it('skips lines that already start with a list marker', () => {
    expect(
      applyMarkdown({ value: '- one\ntwo', selectionStart: 0, selectionEnd: 9 }, 'list'),
    ).toEqual({
      value: '- one\n- two',
      selectionStart: 0,
      selectionEnd: 11,
    });
  });

  it('prefixes the current line when the selection is empty', () => {
    expect(applyMarkdown({ value: 'item', selectionStart: 2, selectionEnd: 2 }, 'list')).toEqual({
      value: '- item',
      selectionStart: 4,
      selectionEnd: 4,
    });
  });
});
