import { sanitiseHttpHref } from '@/lib/serviceLinks';

export type MarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'strong'; children: MarkdownInline[] }
  | { type: 'em'; children: MarkdownInline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: MarkdownInline[] };

export type MarkdownBlock =
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { type: 'codeBlock'; value: string };

const UNORDERED_ITEM = /^[-*] (.*)$/;
const ORDERED_ITEM = /^\d+\. (.*)$/;

function pushText(nodes: MarkdownInline[], value: string): void {
  if (value === '') return;
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') {
    last.value += value;
    return;
  }
  nodes.push({ type: 'text', value });
}

function readCodeSpan(input: string, start: number): { value: string; end: number } | null {
  if (input[start] !== '`') return null;
  const close = input.indexOf('`', start + 1);
  if (close <= start + 1) return null;
  return { value: input.slice(start + 1, close), end: close + 1 };
}

function findDelimiterClose(input: string, from: number, delimiter: string): number {
  const close = input.indexOf(delimiter, from);
  if (close < from) return -1;
  if (delimiter !== '**') return close;
  let runEnd = close;
  while (input[runEnd] === '*') runEnd += 1;
  if (runEnd - close >= 3) return runEnd - 2;
  return close;
}

function readDelimited(
  input: string,
  start: number,
  delimiter: string,
): { content: string; end: number } | null {
  if (!input.startsWith(delimiter, start)) return null;
  const from = start + delimiter.length;
  const close = findDelimiterClose(input, from, delimiter);
  if (close < from) return null;
  const content = input.slice(from, close);
  if (content === '') return null;
  return { content, end: close + delimiter.length };
}

function readLink(
  input: string,
  start: number,
): { href: string; label: string; end: number } | null {
  if (input[start] !== '[') return null;
  if (start > 0 && input[start - 1] === '!') return null;
  const mid = input.indexOf('](', start + 1);
  if (mid < 0) return null;
  const label = input.slice(start + 1, mid);
  if (label === '') return null;
  let depth = 1;
  let index = mid + 2;
  while (index < input.length) {
    const char = input[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        const href = sanitiseHttpHref(input.slice(mid + 2, index));
        if (!href) return null;
        return { href, label, end: index + 1 };
      }
    }
    index += 1;
  }
  return null;
}

function parseInline(input: string, breaks = true): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === '\n') {
      if (breaks) nodes.push({ type: 'break' });
      else pushText(nodes, '\n');
      index += 1;
      continue;
    }

    const code = readCodeSpan(input, index);
    if (code) {
      nodes.push({ type: 'code', value: code.value });
      index = code.end;
      continue;
    }

    const link = readLink(input, index);
    if (link) {
      nodes.push({
        type: 'link',
        href: link.href,
        children: parseInline(link.label, breaks),
      });
      index = link.end;
      continue;
    }

    const strong = readDelimited(input, index, '**');
    if (strong) {
      nodes.push({ type: 'strong', children: parseInline(strong.content, breaks) });
      index = strong.end;
      continue;
    }

    const emStar = readDelimited(input, index, '*');
    if (emStar) {
      nodes.push({ type: 'em', children: parseInline(emStar.content, breaks) });
      index = emStar.end;
      continue;
    }

    const emUnder = readDelimited(input, index, '_');
    if (emUnder) {
      nodes.push({ type: 'em', children: parseInline(emUnder.content, breaks) });
      index = emUnder.end;
      continue;
    }

    pushText(nodes, char ?? '');
    index += 1;
  }
  return nodes;
}

function matchUnordered(line: string): string | null {
  const match = UNORDERED_ITEM.exec(line);
  return match ? (match[1] ?? '') : null;
}

function matchOrdered(line: string): string | null {
  const match = ORDERED_ITEM.exec(line);
  return match ? (match[1] ?? '') : null;
}

function readFence(lines: string[], start: number): { value: string; end: number } {
  const content: string[] = [];
  let index = start + 1;
  while (index < lines.length) {
    if (lines[index]?.startsWith('```')) {
      return { value: content.join('\n'), end: index + 1 };
    }
    content.push(lines[index] ?? '');
    index += 1;
  }
  return { value: content.join('\n'), end: index };
}

function parseBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const fence = readFence(lines, index);
      blocks.push({ type: 'codeBlock', value: fence.value });
      index = fence.end;
      continue;
    }

    const unordered = matchUnordered(line);
    const ordered = matchOrdered(line);
    if (unordered !== null || ordered !== null) {
      const isOrdered = ordered !== null;
      const items: MarkdownInline[][] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const item = isOrdered ? matchOrdered(current) : matchUnordered(current);
        if (item === null) break;
        items.push(parseInline(item));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (current.trim() === '') break;
      if (current.startsWith('```')) break;
      if (matchUnordered(current) !== null || matchOrdered(current) !== null) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
  }

  return blocks;
}

export function parseCardMarkdown(text: string, options?: { blocks?: boolean }): MarkdownBlock[] {
  if (text === '') return [];
  const normalised = text.replace(/\r\n/g, '\n');
  if (options?.blocks === false) {
    return [{ type: 'paragraph', children: parseInline(normalised, false) }];
  }
  return parseBlocks(normalised);
}
