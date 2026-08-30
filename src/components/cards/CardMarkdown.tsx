import type { ReactNode } from 'react';

import ServiceLinkText, { CardTextLink } from '@/components/cards/ServiceLinkText';
import { parseCardMarkdown, type MarkdownBlock, type MarkdownInline } from '@/lib/cardMarkdown';
import { recognizeServiceLink } from '@/lib/serviceLinks';
import { cn } from '@/lib/utils';

function InlineNodes({
  nodes,
  expandServices = true,
}: {
  nodes: MarkdownInline[];
  expandServices?: boolean;
}) {
  return (
    <>
      {nodes.map((node, index) => (
        <InlineNode key={index} node={node} expandServices={expandServices} />
      ))}
    </>
  );
}

function InlineNode({
  node,
  expandServices = true,
}: {
  node: MarkdownInline;
  expandServices?: boolean;
}) {
  switch (node.type) {
    case 'text':
      return expandServices ? <ServiceLinkText text={node.value} /> : node.value;
    case 'break':
      return <br />;
    case 'strong':
      return (
        <strong className="font-semibold">
          <InlineNodes nodes={node.children} expandServices={expandServices} />
        </strong>
      );
    case 'em':
      return (
        <em>
          <InlineNodes nodes={node.children} expandServices={expandServices} />
        </em>
      );
    case 'code':
      return (
        <code className="rounded-sm bg-muted px-1 py-px font-mono text-[0.9em]">{node.value}</code>
      );
    case 'link': {
      const recognised = recognizeServiceLink(node.href);
      return (
        <CardTextLink href={node.href} service={recognised?.service}>
          <InlineNodes nodes={node.children} expandServices={false} />
        </CardTextLink>
      );
    }
  }
}

function BlockNode({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="m-0">
          <InlineNodes nodes={block.children} />
        </p>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List
          className={cn(
            'm-0 flex flex-col gap-0.5 pl-5',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineNodes nodes={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'codeBlock':
      return (
        <pre className="m-0 overflow-x-auto rounded-md border border-border bg-muted px-2.5 py-2 font-mono text-[0.85em] leading-[1.5]">
          <code>{block.value}</code>
        </pre>
      );
  }
}

export default function CardMarkdown({
  text,
  variant = 'full',
  className,
}: {
  text: string;
  variant?: 'inline' | 'full';
  className?: string;
}) {
  const blocks = parseCardMarkdown(text, { blocks: variant === 'full' });
  if (variant === 'inline') {
    const children: ReactNode[] = [];
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        children.push(<InlineNodes key={children.length} nodes={block.children} />);
      }
    }
    return <span className={className}>{children}</span>;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} />
      ))}
    </div>
  );
}
