// tests/lib/cardMarkdown.test.ts
//
// Tests for the closed markdown subset used on card text.
//
// Tested:
// - Bold, italic, lists, inline code, code blocks, and links parse
// - Inline variant leaves list markers and fences as characters
// - Inline variant treats a newline as whitespace, not a break
// - A single newline is a hard break; a blank line starts a paragraph
// - A list does not swallow the following paragraph
// - Unclosed fences, half bold, headings, tables, and images stay readable
// - Hostile hrefs never become a link node
//
// What is covered:
// - Happy path per feature, inline vs full, malformed, unsupported, hostile href
//
// Run with: pnpm test:run tests/lib/cardMarkdown.test.ts
//
// SEE: src/lib/cardMarkdown.ts

import { describe, it, expect } from 'vitest';

import { parseCardMarkdown } from '@/lib/cardMarkdown';

describe('parseCardMarkdown', () => {
  it('returns no blocks for empty text', () => {
    expect(parseCardMarkdown('')).toEqual([]);
  });

  it('parses a paragraph of plain text', () => {
    expect(parseCardMarkdown('Hello board')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'Hello board' }] },
    ]);
  });

  it('parses bold, italic, and inline code', () => {
    expect(parseCardMarkdown('**bold** and *italic* and `code`')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
          { type: 'text', value: ' and ' },
          { type: 'em', children: [{ type: 'text', value: 'italic' }] },
          { type: 'text', value: ' and ' },
          { type: 'code', value: 'code' },
        ],
      },
    ]);
  });

  it('parses underscore italic the same way as asterisk italic', () => {
    expect(parseCardMarkdown('_quiet_')).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'em', children: [{ type: 'text', value: 'quiet' }] }],
      },
    ]);
  });

  it('keeps markers inside inline code as text', () => {
    expect(parseCardMarkdown('`pnpm **test**`')).toEqual([
      { type: 'paragraph', children: [{ type: 'code', value: 'pnpm **test**' }] },
    ]);
  });

  it('parses an unordered list and an ordered list', () => {
    expect(parseCardMarkdown('- one\n- two')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', value: 'one' }], [{ type: 'text', value: 'two' }]],
      },
    ]);
    expect(parseCardMarkdown('1. first\n2. second')).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [[{ type: 'text', value: 'first' }], [{ type: 'text', value: 'second' }]],
      },
    ]);
  });

  it('treats a task-list marker as ordinary list item text', () => {
    expect(parseCardMarkdown('- [ ] still a bullet')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', value: '[ ] still a bullet' }]],
      },
    ]);
  });

  it('parses a fenced code block and ignores a language tag', () => {
    expect(parseCardMarkdown('```js\nconst n = 1;\n```')).toEqual([
      { type: 'codeBlock', value: 'const n = 1;' },
    ]);
  });

  it('parses a markdown link with a sanitised http href', () => {
    expect(parseCardMarkdown('[docs](https://example.com/x)')).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            href: 'https://example.com/x',
            children: [{ type: 'text', value: 'docs' }],
          },
        ],
      },
    ]);
  });

  it('rebuilds a link href without userinfo', () => {
    const parsed = parseCardMarkdown('[x](https://user:pass@example.com/a)');
    const link = parsed[0] && parsed[0].type === 'paragraph' ? parsed[0].children[0] : null;
    expect(link).toEqual({
      type: 'link',
      href: 'https://example.com/a',
      children: [{ type: 'text', value: 'x' }],
    });
  });

  it('turns a single newline into a hard break and a blank line into a new paragraph', () => {
    expect(parseCardMarkdown('hello\nworld')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'hello' },
          { type: 'break' },
          { type: 'text', value: 'world' },
        ],
      },
    ]);
    expect(parseCardMarkdown('hello\n\nworld')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'hello' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'world' }] },
    ]);
  });

  it('does not let a list swallow the following paragraph', () => {
    expect(parseCardMarkdown('- item\nfollowing prose')).toEqual([
      { type: 'list', ordered: false, items: [[{ type: 'text', value: 'item' }]] },
      { type: 'paragraph', children: [{ type: 'text', value: 'following prose' }] },
    ]);
  });

  it('leaves list markers and fences as characters in the inline variant', () => {
    expect(parseCardMarkdown('- a title', { blocks: false })).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '- a title' }] },
    ]);
    expect(parseCardMarkdown('```\ncode', { blocks: false })).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '```\ncode' }] },
    ]);
  });

  it('treats a newline as whitespace in the inline variant and as a break in the full variant', () => {
    expect(parseCardMarkdown('hello\nworld', { blocks: false })).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'hello\nworld' }] },
    ]);
    expect(parseCardMarkdown('hello\nworld')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'hello' },
          { type: 'break' },
          { type: 'text', value: 'world' },
        ],
      },
    ]);
  });

  it('still applies inline marks in the inline variant', () => {
    expect(parseCardMarkdown('**Title**', { blocks: false })).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'strong', children: [{ type: 'text', value: 'Title' }] }],
      },
    ]);
  });

  it('leaves a half-bold marker as characters', () => {
    expect(parseCardMarkdown('this is **not bold')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'this is **not bold' }] },
    ]);
  });

  it('treats an unclosed fence as a code block through the end of the text', () => {
    expect(parseCardMarkdown('```\nconst n = 1;')).toEqual([
      { type: 'codeBlock', value: 'const n = 1;' },
    ]);
  });

  it('closes strong at the first closer and leaves leftover markers as text', () => {
    expect(parseCardMarkdown('**a *b** c*')).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [{ type: 'text', value: 'a *b' }],
          },
          { type: 'text', value: ' c*' },
        ],
      },
    ]);
  });

  it('leaves headings, tables, and images as text', () => {
    expect(parseCardMarkdown('# Title')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '# Title' }] },
    ]);
    expect(parseCardMarkdown('| a | b |')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '| a | b |' }] },
    ]);
    expect(parseCardMarkdown('![alt](https://example.com/x.png)')).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '![alt](https://example.com/x.png)' }],
      },
    ]);
  });

  it('does not turn a javascript or data href into a link node', () => {
    expect(parseCardMarkdown('[click](javascript:alert(1))')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '[click](javascript:alert(1))' }] },
    ]);
    expect(parseCardMarkdown('[x](data:text/html,hi)')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '[x](data:text/html,hi)' }] },
    ]);
  });

  it('does not turn raw HTML into a node other than text', () => {
    expect(parseCardMarkdown('<script>alert(1)</script>')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '<script>alert(1)</script>' }] },
    ]);
  });

  it('leaves an empty markdown link as text', () => {
    expect(parseCardMarkdown('[](https://example.com)')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '[](https://example.com)' }] },
    ]);
  });

  it('parses italic inside bold', () => {
    expect(parseCardMarkdown('**bold *and italic***')).toEqual([
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [
              { type: 'text', value: 'bold ' },
              { type: 'em', children: [{ type: 'text', value: 'and italic' }] },
            ],
          },
        ],
      },
    ]);
  });
});
