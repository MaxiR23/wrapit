// tests/lib/serviceLinks.test.ts
//
// Tests for recognising service URLs in card text.
//
// Tested:
// - Each known service yields a label derived from the URL
// - A GitHub issue reads as owner/repo#n rather than the path
// - An unrecognised URL is left as text
// - Hostile and malformed strings never become a service href
// - Userinfo is stripped from the stored href
//
// What is covered:
// - Happy path per service, mixed text, scheme-less, www, http,
//   allowlist, userinfo, javascript/data, malformed
//
// Run with: pnpm test:run tests/lib/serviceLinks.test.ts
//
// SEE: src/lib/serviceLinks.ts

import { describe, it, expect } from 'vitest';

import { recognizeServiceLink, splitServiceLinks } from '@/lib/serviceLinks';

describe('recognizeServiceLink', () => {
  it('labels a GitHub issue from the owner, repo, and number', () => {
    const result = recognizeServiceLink('https://github.com/wrapit/wrapit/issues/42');

    expect(result).toEqual({
      service: 'github',
      label: 'wrapit/wrapit#42',
      href: 'https://github.com/wrapit/wrapit/issues/42',
    });
  });

  it('labels a GitHub pull request the same way as an issue', () => {
    const result = recognizeServiceLink('https://github.com/wrapit/wrapit/pull/7');

    expect(result).toEqual({
      service: 'github',
      label: 'wrapit/wrapit#7',
      href: 'https://github.com/wrapit/wrapit/pull/7',
    });
  });

  it('labels a Figma file from the slug', () => {
    const result = recognizeServiceLink('https://www.figma.com/design/abc123/My-Design-File');

    expect(result).toEqual({
      service: 'figma',
      label: 'My Design File',
      href: 'https://www.figma.com/design/abc123/My-Design-File',
    });
  });

  it('labels a Notion page from the title in the path', () => {
    const result = recognizeServiceLink(
      'https://www.notion.so/My-Page-Title-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    expect(result).toEqual({
      service: 'notion',
      label: 'My Page Title',
      href: 'https://www.notion.so/My-Page-Title-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  it('labels Google Docs, Sheets, and Slides from the path type', () => {
    expect(recognizeServiceLink('https://docs.google.com/document/d/abc/edit')?.label).toBe(
      'Google Doc',
    );
    expect(recognizeServiceLink('https://docs.google.com/spreadsheets/d/abc/edit')?.label).toBe(
      'Google Sheet',
    );
    expect(recognizeServiceLink('https://docs.google.com/presentation/d/abc/edit')?.label).toBe(
      'Google Slide',
    );
  });

  it('labels a Slack archive URL as Slack', () => {
    const result = recognizeServiceLink(
      'https://wrapit.slack.com/archives/C01234567/p1234567890123456',
    );

    expect(result).toEqual({
      service: 'slack',
      label: 'Slack',
      href: 'https://wrapit.slack.com/archives/C01234567/p1234567890123456',
    });
  });

  it('matches http and a www host without rewriting them', () => {
    const result = recognizeServiceLink('http://www.github.com/wrapit/wrapit');

    expect(result).toEqual({
      service: 'github',
      label: 'wrapit/wrapit',
      href: 'http://www.github.com/wrapit/wrapit',
    });
  });

  it('rebuilds the href without userinfo', () => {
    const result = recognizeServiceLink('https://user:pass@github.com/wrapit/wrapit');

    expect(result?.href).toBe('https://github.com/wrapit/wrapit');
    expect(result?.href).not.toContain('user');
    expect(result?.href).not.toContain('pass');
  });

  it('returns null for an unrecognised host', () => {
    expect(recognizeServiceLink('https://example.com/x')).toBeNull();
  });

  it('returns null when the host only looks like a service as a substring', () => {
    expect(recognizeServiceLink('https://github.com.evil.example/org/repo')).toBeNull();
    expect(recognizeServiceLink('https://evil.example/github.com/org/repo')).toBeNull();
    expect(recognizeServiceLink('https://notslack.com/archives/C0123')).toBeNull();
  });

  it('returns null for javascript and data URLs', () => {
    expect(recognizeServiceLink('javascript:alert(1)')).toBeNull();
    expect(recognizeServiceLink('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(recognizeServiceLink('https://[')).toBeNull();
  });
});

describe('splitServiceLinks', () => {
  it('leaves an unrecognised URL as a single text segment', () => {
    expect(splitServiceLinks('https://example.com/x')).toEqual([
      { type: 'text', value: 'https://example.com/x' },
    ]);
  });

  it('leaves a scheme-less address as text', () => {
    expect(splitServiceLinks('github.com/wrapit/wrapit/issues/42')).toEqual([
      { type: 'text', value: 'github.com/wrapit/wrapit/issues/42' },
    ]);
  });

  it('splits mixed text around a recognised URL', () => {
    expect(splitServiceLinks('See https://github.com/org/repo/issues/1 please')).toEqual([
      { type: 'text', value: 'See ' },
      {
        type: 'service',
        service: 'github',
        label: 'org/repo#1',
        href: 'https://github.com/org/repo/issues/1',
      },
      { type: 'text', value: ' please' },
    ]);
  });

  it('leaves a hostile string unchanged', () => {
    expect(splitServiceLinks('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });
});
