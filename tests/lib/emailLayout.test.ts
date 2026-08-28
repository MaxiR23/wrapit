// tests/lib/emailLayout.test.ts
//
// Tests for the shared transactional email layout.
//
// Tested:
// - Renders a 600px centered table, a padded table-cell button, and a VML fallback
// - Includes dark-mode metas, a prefers-color-scheme block, and Outlook selectors
// - Avoids pure black and white
// - Puts the token only in the button hrefs and the fallback URL
// - Escapes ampersands in HTML hrefs; the plain-text part keeps the raw URL
// - Stays well under the Gmail clip size
// - Builds the plain-text alternative from the same content fields
//
// What is covered:
// - Happy path, HTML escaping, token placement, size, dark-mode hooks, plain text
//
// Run with: pnpm test:run tests/lib/emailLayout.test.ts
//
// SEE: src/lib/emailLayout.ts

import { describe, it, expect } from 'vitest';

import { renderTransactionalEmail } from '@/lib/emailLayout';

const content = {
  preheader: 'Confirm this address to finish creating your wrapit account.',
  heading: 'Verify your email',
  body: 'Confirm this address to finish creating your wrapit account.',
  buttonLabel: 'Verify email',
  url: 'http://localhost:3000/api/auth/verify-email?token=secret-token-xyz&callbackURL=/verify-email',
  footer:
    'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
};

const escapedUrl =
  'http://localhost:3000/api/auth/verify-email?token=secret-token-xyz&amp;callbackURL=/verify-email';

describe('renderTransactionalEmail', () => {
  const { html, text } = renderTransactionalEmail(content);

  it('renders a 600px table centered with align and CSS', () => {
    expect(html).toContain('width="600"');
    expect(html).toContain('align="center"');
    expect(html).toContain('margin:0 auto');
  });

  it('uses a padded table cell as the visible button, not padding on the anchor', () => {
    expect(html).toMatch(/<td[^>]*bgcolor="/);
    expect(html).toMatch(/<td[^>]*padding:\s*12px 24px/);
    expect(html).not.toMatch(/<a[^>]*padding:\s*12px 24px/);
  });

  it('includes a VML roundrect so classic Outlook has a fully clickable button', () => {
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('v:roundrect');
    expect(html).toContain(`href="${escapedUrl}"`);
    expect(html).toContain('<!--[if !mso]><!-->');
  });

  it('shows the full URL as a fallback under the button', () => {
    const buttonIndex = html.indexOf('v:roundrect');
    const fallbackIndex = html.indexOf(escapedUrl, buttonIndex + 1);
    expect(fallbackIndex).toBeGreaterThan(buttonIndex);
    expect(html).toContain(escapedUrl);
  });

  it('includes dark-mode metas, a prefers-color-scheme block, and Outlook selectors', () => {
    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('content="light dark"');
    expect(html).toContain('name="supported-color-schemes"');
    expect(html).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    expect(html).toContain('!important');
    expect(html).toContain('[data-ogsc]');
  });

  it('does not use pure black or white', () => {
    expect(html).not.toMatch(/#000000|#ffffff|#000[;\s"']|#fff[;\s"']/i);
  });

  it('puts the token only in the button hrefs and the fallback URL', () => {
    const withoutHrefs = html.replace(/href="[^"]*"/g, 'href=""');
    const withoutVisibleUrl = withoutHrefs.replaceAll(escapedUrl, '');
    expect(html).toContain('secret-token-xyz');
    expect(withoutVisibleUrl).not.toContain('secret-token-xyz');
    expect(withoutVisibleUrl).not.toContain(content.url);
  });

  it('escapes ampersands in HTML and leaves the raw URL in the plain-text part', () => {
    expect(html).toContain(escapedUrl);
    expect(html).not.toContain(`${content.url}"`);
    expect(text).toContain(content.url);
    expect(text).not.toContain('&amp;');
  });

  it('stays well under the size where Gmail clips', () => {
    expect(html.length).toBeLessThan(20_000);
  });

  it('builds the plain-text alternative from the same content fields', () => {
    expect(text).toContain(content.heading);
    expect(text).toContain(content.body);
    expect(text).toContain(content.buttonLabel);
    expect(text).toContain(content.url);
    expect(text).toContain(content.footer);
  });

  it('includes a hidden preheader so the inbox snippet is not the URL', () => {
    expect(html).toContain(content.preheader);
    expect(html).toMatch(/display:\s*none/);
  });
});
