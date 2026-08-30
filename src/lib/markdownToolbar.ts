export type MarkdownAction = 'bold' | 'italic' | 'code' | 'codeBlock' | 'link' | 'list';

export type TextSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const LIST_ITEM = /^(?:[-*] |\d+\. )/;

function wrap(
  snapshot: TextSelection,
  before: string,
  after: string,
  emptyCaretOffset: number,
): TextSelection {
  const { value, selectionStart, selectionEnd } = snapshot;
  const selected = value.slice(selectionStart, selectionEnd);
  const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
  if (selected === '') {
    const caret = selectionStart + emptyCaretOffset;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  const caret = selectionStart + before.length + selected.length + after.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

function applyCodeBlock(snapshot: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = snapshot;
  const selected = value.slice(selectionStart, selectionEnd);
  if (selected === '') {
    const next = `${value.slice(0, selectionStart)}\`\`\`\n\n\`\`\`${value.slice(selectionEnd)}`;
    const caret = selectionStart + 4;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  const prefix = value.slice(0, selectionStart);
  const suffix = value.slice(selectionEnd);
  const next = `${prefix}\n\`\`\`\n${selected}\n\`\`\`\n${suffix}`;
  const caret = prefix.length + 5 + selected.length + 5;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

function applyLink(snapshot: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = snapshot;
  const selected = value.slice(selectionStart, selectionEnd);
  if (selected === '') {
    const next = `${value.slice(0, selectionStart)}[](url)${value.slice(selectionEnd)}`;
    const caret = selectionStart + 1;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  const next = `${value.slice(0, selectionStart)}[${selected}](url)${value.slice(selectionEnd)}`;
  const urlStart = selectionStart + selected.length + 3;
  return { value: next, selectionStart: urlStart, selectionEnd: urlStart + 3 };
}

function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let to = value.indexOf('\n', end);
  if (to < 0) to = value.length;
  return { from, to };
}

function applyList(snapshot: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = snapshot;
  const { from, to } = lineRange(value, selectionStart, selectionEnd);
  const block = value.slice(from, to);
  const lines = block.split('\n');
  const nextLines = lines.map((line) => (LIST_ITEM.test(line) ? line : `- ${line}`));
  const nextBlock = nextLines.join('\n');
  const next = `${value.slice(0, from)}${nextBlock}${value.slice(to)}`;
  const delta = nextBlock.length - block.length;
  if (selectionStart === selectionEnd) {
    const caret = selectionStart + delta;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  return {
    value: next,
    selectionStart: from,
    selectionEnd: from + nextBlock.length,
  };
}

export function applyMarkdown(snapshot: TextSelection, action: MarkdownAction): TextSelection {
  switch (action) {
    case 'bold':
      return wrap(snapshot, '**', '**', 2);
    case 'italic':
      return wrap(snapshot, '*', '*', 1);
    case 'code':
      return wrap(snapshot, '`', '`', 1);
    case 'codeBlock':
      return applyCodeBlock(snapshot);
    case 'link':
      return applyLink(snapshot);
    case 'list':
      return applyList(snapshot);
  }
}
