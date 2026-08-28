export type TransactionalEmailContent = {
  preheader: string;
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  footer: string;
};

const color = {
  page: '#f4f3f1',
  card: '#faf9f7',
  text: '#1c1c1c',
  muted: '#5c5c5c',
  button: '#2a2a2a',
  buttonText: '#f7f6f3',
  darkPage: '#1c1c1c',
  darkCard: '#2a2a2a',
  darkText: '#f0eee9',
  darkMuted: '#b0aea8',
  darkButton: '#e8e6e1',
  darkButtonText: '#1c1c1c',
} as const;

/**
 * Shared HTML + plain-text layout for transactional mail. Callers supply words
 * and a button; adding another email should not mean another layout.
 */
export function renderTransactionalEmail(content: TransactionalEmailContent): {
  html: string;
  text: string;
} {
  const preheader = escapeHtml(content.preheader);
  const heading = escapeHtml(content.heading);
  const body = escapeHtml(content.body);
  const buttonLabel = escapeHtml(content.buttonLabel);
  const url = escapeHtml(content.url);
  const footer = escapeHtml(content.footer);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<!--[if gte mso 9]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<style>
html, body { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
${darkOverrides('')}
}
${darkOverrides('[data-ogsc] ')}
${darkOverrides('[data-ogsb] ')}
</style>
</head>
<body class="email-body" bgcolor="${color.page}" style="margin:0; padding:0; background-color:${color.page}; color:${color.text}; font-family:Arial, Helvetica, sans-serif;">
<div style="display:none; font-size:1px; color:${color.page}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${color.page}" class="email-body" style="background-color:${color.page};">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" align="center" border="0" cellpadding="0" cellspacing="0" class="email-card" bgcolor="${color.card}" style="width:600px; max-width:600px; margin:0 auto; background-color:${color.card};">
<tr>
<td style="padding:32px 32px 24px 32px; font-family:Arial, Helvetica, sans-serif;">
<p class="email-wordmark" style="margin:0 0 24px 0; font-size:14px; letter-spacing:0.04em; color:${color.muted};">wrapit</p>
<h1 class="email-heading" style="margin:0 0 12px 0; font-size:22px; line-height:28px; font-weight:bold; color:${color.text};">${heading}</h1>
<p class="email-text" style="margin:0 0 24px 0; font-size:16px; line-height:24px; color:${color.text};">${body}</p>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${color.button}" fillcolor="${color.button}">
<w:anchorlock/>
<center style="color:${color.buttonText};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${buttonLabel}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0">
<tr>
<td class="email-button" align="center" bgcolor="${color.button}" style="background-color:${color.button}; padding:12px 24px; border-radius:6px;">
<a class="email-button-link" href="${url}" target="_blank" style="font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:${color.buttonText}; text-decoration:none;">${buttonLabel}</a>
</td>
</tr>
</table>
<!--<![endif]-->
<p class="email-fallback" style="margin:24px 0 0 0; font-size:12px; line-height:18px; color:${color.muted}; word-break:break-all;">Or paste this link into your browser:<br />
<a href="${url}" style="color:${color.muted}; text-decoration:underline;">${url}</a></p>
<p class="email-muted" style="margin:24px 0 0 0; font-size:12px; line-height:18px; color:${color.muted};">${footer}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    '',
    content.body,
    '',
    `${content.buttonLabel}:`,
    content.url,
    '',
    content.footer,
  ].join('\n');

  return { html, text };
}

function darkOverrides(prefix: string): string {
  return `${prefix}.email-body { background-color: ${color.darkPage} !important; }
${prefix}.email-card { background-color: ${color.darkCard} !important; }
${prefix}.email-heading, ${prefix}.email-text { color: ${color.darkText} !important; }
${prefix}.email-muted, ${prefix}.email-wordmark, ${prefix}.email-fallback, ${prefix}.email-fallback a { color: ${color.darkMuted} !important; }
${prefix}.email-button { background-color: ${color.darkButton} !important; }
${prefix}.email-button-link { color: ${color.darkButtonText} !important; }`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
