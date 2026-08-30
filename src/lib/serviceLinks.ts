export type ServiceId = 'github' | 'figma' | 'notion' | 'google-docs' | 'slack';

export type ServiceLinkMatch = {
  href: string;
  service: ServiceId;
  label: string;
};

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'service'; href: string; service: ServiceId; label: string };

type ServiceRule = {
  id: ServiceId;
  matchesHost: (host: string) => boolean;
  label: (url: URL, host: string) => string;
};

const MAX_URL_LENGTH = 2048;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>[\]()]+/gi;

const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

const NOTION_ID =
  /(?:-)?([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const FIGMA_KINDS = new Set(['file', 'design', 'board', 'proto', 'slides', 'deck', 'figjam']);

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hyphensToSpaces(value: string): string {
  return value.replace(/-/g, ' ').trim();
}

function pathParts(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function githubLabel(url: URL, host: string): string {
  const parts = pathParts(url);
  if (host === 'gist.github.com') {
    const user = parts[0];
    if (user && !/^[0-9a-f]{20,}$/i.test(user)) return `${decodeSegment(user)} gist`;
    return 'Gist';
  }

  const owner = parts[0];
  const repo = parts[1];
  if (!owner) return 'GitHub';
  if (!repo) return decodeSegment(owner);

  const kind = parts[2];
  const id = parts[3];
  if ((kind === 'issues' || kind === 'pull' || kind === 'discussions') && id && /^\d+$/.test(id)) {
    return `${decodeSegment(owner)}/${decodeSegment(repo)}#${id}`;
  }
  if (kind === 'commit' && id) {
    return `${decodeSegment(owner)}/${decodeSegment(repo)}@${id.slice(0, 7)}`;
  }
  if (kind === 'releases' && id === 'tag' && parts[4]) {
    return `${decodeSegment(owner)}/${decodeSegment(repo)}@${decodeSegment(parts[4])}`;
  }
  return `${decodeSegment(owner)}/${decodeSegment(repo)}`;
}

function figmaLabel(url: URL): string {
  const parts = pathParts(url);
  for (let index = 0; index < parts.length; index += 1) {
    const kind = parts[index];
    const slug = parts[index + 2];
    if (kind && FIGMA_KINDS.has(kind) && parts[index + 1] && slug) {
      const label = hyphensToSpaces(decodeSegment(slug));
      return label || 'Figma';
    }
  }
  return 'Figma';
}

function notionLabel(url: URL): string {
  const parts = pathParts(url);
  const last = parts[parts.length - 1];
  if (!last) return 'Notion';
  const stripped = last.replace(NOTION_ID, '');
  if (!stripped) return 'Notion';
  return hyphensToSpaces(decodeSegment(stripped)) || 'Notion';
}

function googleDocsLabel(url: URL): string {
  const path = url.pathname;
  if (path.includes('/spreadsheets/')) return 'Google Sheet';
  if (path.includes('/presentation/')) return 'Google Slide';
  return 'Google Doc';
}

/** Adding a sixth service is one object in this list. */
export const SERVICE_LINK_RULES: readonly ServiceRule[] = [
  {
    id: 'github',
    matchesHost: (host) => host === 'github.com' || host === 'gist.github.com',
    label: githubLabel,
  },
  {
    id: 'figma',
    matchesHost: (host) => host === 'figma.com',
    label: (url) => figmaLabel(url),
  },
  {
    id: 'notion',
    matchesHost: (host) =>
      host === 'notion.so' || host === 'notion.site' || host.endsWith('.notion.site'),
    label: (url) => notionLabel(url),
  },
  {
    id: 'google-docs',
    matchesHost: (host) => host === 'docs.google.com',
    label: (url) => googleDocsLabel(url),
  },
  {
    id: 'slack',
    matchesHost: (host) => host === 'slack.com' || host.endsWith('.slack.com'),
    label: () => 'Slack',
  },
];

function normalizeHost(hostname: string): string {
  let host = hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
}

function sanitisedHref(url: URL): string {
  return `${url.origin}${url.pathname}${url.search}${url.hash}`;
}

function parseHttpUrl(raw: string): URL | null {
  if (raw.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/** http(s) only, hostname required, userinfo stripped. Null means do not link. */
export function sanitiseHttpHref(raw: string): string | null {
  const url = parseHttpUrl(raw.trim());
  if (!url) return null;
  return sanitisedHref(url);
}

/** Match a single URL to a known service. Null means leave the text as-is. */
export function recognizeServiceLink(raw: string): ServiceLinkMatch | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const host = normalizeHost(url.hostname);
  const rule = SERVICE_LINK_RULES.find((item) => item.matchesHost(host));
  if (!rule) return null;
  return {
    service: rule.id,
    label: rule.label(url, host),
    href: sanitisedHref(url),
  };
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(TRAILING_PUNCTUATION, '');
}

/** Split user text into plain runs and recognised service links. */
export function splitServiceLinks(text: string): TextSegment[] {
  if (text === '') return [];
  const segments: TextSegment[] = [];
  const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let lastIndex = 0;
  let match = pattern.exec(text);
  while (match) {
    const raw = match[0] ?? '';
    const start = match.index;
    const trimmed = trimTrailingPunctuation(raw);
    const recognised = trimmed ? recognizeServiceLink(trimmed) : null;
    if (recognised) {
      if (start > lastIndex) {
        segments.push({ type: 'text', value: text.slice(lastIndex, start) });
      }
      segments.push({ type: 'service', ...recognised });
      lastIndex = start + trimmed.length;
      pattern.lastIndex = lastIndex;
    }
    match = pattern.exec(text);
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
