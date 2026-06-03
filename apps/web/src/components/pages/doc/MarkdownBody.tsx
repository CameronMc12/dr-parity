'use client';

import { useMemo } from 'react';
import { DOC, DOC_SPACE } from './tokens';
import {
  type Block,
  type InlineNode,
  parseMarkdown,
} from './markdown';

/**
 * Renders ClickUp doc markdown as styled, read-only React. Typography and
 * spacing mirror ClickUp's doc reading column. Used for the non-editing view;
 * the editable surface is `DocEditor`, which renders the raw markdown.
 */
export function MarkdownBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  if (blocks.length === 0) {
    return (
      <p
        data-testid="doc-empty-body"
        style={{ color: DOC.textMuted, fontSize: 14, marginTop: 8 }}
      >
        This page is empty. Start writing…
      </p>
    );
  }

  return (
    <div data-testid="doc-markdown-body" style={{ fontSize: 15, lineHeight: 1.65 }}>
      {blocks.map((block, i) => (
        <BlockView key={blockKey(block, i)} block={block} />
      ))}
    </div>
  );
}

/**
 * Stable-ish key for a top-level block: type + a short content hash. This keeps
 * React reconciliation aligned when blocks of the same type shift position after
 * an edit/AI insert (index-only keys reuse the wrong DOM node). The trailing
 * index disambiguates blocks that hash identically (e.g. repeated dividers).
 */
function blockKey(block: Block, index: number): string {
  return `${block.type}-${hashString(blockSignature(block))}-${index}`;
}

function blockSignature(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `${block.level}:${inlineText(block.inline)}`;
    case 'paragraph':
    case 'quote':
      return inlineText(block.inline);
    case 'list':
      return `${block.ordered}:${block.items.map(inlineText).join('|')}`;
    case 'checklist':
      return block.items.map((it) => `${it.checked}:${inlineText(it.inline)}`).join('|');
    case 'code':
      return block.value;
    case 'image':
      return block.src;
    case 'table':
      return block.header.map(inlineText).join('|');
    case 'divider':
      return 'hr';
    default:
      return '';
  }
}

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case 'text':
          return n.value;
        case 'code':
          return n.value;
        case 'image':
          return n.src;
        case 'bold':
        case 'italic':
        case 'link':
          return inlineText(n.children);
        default:
          return '';
      }
    })
    .join('');
}

function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading':
      return <Heading level={block.level} inline={block.inline} />;
    case 'paragraph':
      return (
        <p style={{ margin: `0 0 ${DOC_SPACE.paragraph}px`, color: DOC.textPrimary }}>
          <Inline nodes={block.inline} />
        </p>
      );
    case 'list':
      return <ListBlock ordered={block.ordered} items={block.items} />;
    case 'checklist':
      return <Checklist items={block.items} />;
    case 'quote':
      return (
        <blockquote
          style={{
            margin: `0 0 ${DOC_SPACE.block}px`,
            padding: '4px 0 4px 16px',
            borderLeft: `3px solid ${DOC.borderStrong}`,
            color: DOC.textSecondary,
            fontStyle: 'italic',
          }}
        >
          <Inline nodes={block.inline} />
        </blockquote>
      );
    case 'divider':
      return (
        <hr
          style={{
            border: 'none',
            borderTop: `1px solid ${DOC.border}`,
            margin: `${DOC_SPACE.block}px 0`,
          }}
        />
      );
    case 'code':
      return (
        <pre
          style={{
            margin: `0 0 ${DOC_SPACE.block}px`,
            padding: '12px 14px',
            background: DOC.input,
            border: `1px solid ${DOC.border}`,
            borderRadius: 6,
            overflowX: 'auto',
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: DOC.textPrimary,
          }}
        >
          <code>{block.value}</code>
        </pre>
      );
    case 'table':
      return <TableBlock header={block.header} rows={block.rows} />;
    case 'image':
      return <DocImage src={block.src} alt={block.alt} />;
    default:
      return null;
  }
}

function Heading({ level, inline }: { level: 1 | 2 | 3; inline: InlineNode[] }) {
  const size = level === 1 ? 28 : level === 2 ? 21 : 17;
  const top =
    level === 1
      ? DOC_SPACE.heading1Top
      : level === 2
        ? DOC_SPACE.heading2Top
        : DOC_SPACE.heading3Top;
  const style = {
    margin: `${top}px 0 ${DOC_SPACE.headingBottom}px`,
    fontSize: size,
    fontWeight: 700,
    lineHeight: 1.3,
    color: DOC.textPrimary,
    fontFamily: DOC.headingFont,
  } as const;
  if (level === 1) return <h1 style={style}><Inline nodes={inline} /></h1>;
  if (level === 2) return <h2 style={style}><Inline nodes={inline} /></h2>;
  return <h3 style={style}><Inline nodes={inline} /></h3>;
}

function ListBlock({
  ordered,
  items,
}: {
  ordered: boolean;
  items: InlineNode[][];
}) {
  const style = {
    margin: `0 0 ${DOC_SPACE.block}px`,
    paddingLeft: 24,
    color: DOC.textPrimary,
  } as const;
  const liStyle = { marginBottom: DOC_SPACE.listItem } as const;
  if (ordered) {
    return (
      <ol style={style}>
        {items.map((item, i) => (
          <li key={`${hashString(inlineText(item))}-${i}`} style={liStyle}>
            <Inline nodes={item} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul style={style}>
      {items.map((item, i) => (
        <li key={`${hashString(inlineText(item))}-${i}`} style={liStyle}>
          <Inline nodes={item} />
        </li>
      ))}
    </ul>
  );
}

function Checklist({
  items,
}: {
  items: { checked: boolean; inline: InlineNode[] }[];
}) {
  return (
    <div style={{ margin: `0 0 ${DOC_SPACE.block}px` }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: DOC_SPACE.listItem,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              marginTop: 4,
              flexShrink: 0,
              borderRadius: 4,
              border: item.checked ? 'none' : `1.5px solid ${DOC.borderStrong}`,
              background: item.checked ? DOC.accent : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#fff',
            }}
          >
            {item.checked ? '✓' : ''}
          </span>
          <span
            style={{
              color: item.checked ? DOC.textMuted : DOC.textPrimary,
              textDecoration: item.checked ? 'line-through' : 'none',
            }}
          >
            <Inline nodes={item.inline} />
          </span>
        </div>
      ))}
    </div>
  );
}

function TableBlock({
  header,
  rows,
}: {
  header: InlineNode[][];
  rows: InlineNode[][][];
}) {
  const cell = {
    padding: '8px 12px',
    border: `1px solid ${DOC.border}`,
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    color: DOC.textPrimary,
  };
  return (
    <div style={{ margin: `0 0 ${DOC_SPACE.block}px`, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} style={{ ...cell, background: DOC.strong, fontWeight: 600 }}>
                <Inline nodes={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, ci) => (
                <td key={ci} style={cell}>
                  <Inline nodes={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocImage({ src, alt }: { src: string; alt: string }) {
  return (
    // Remote ClickUp attachment URLs; native img is correct here (next/image
    // can't optimise unknown external CDN hosts, and the clone mirrors raw URLs).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
        margin: `0 0 ${DOC_SPACE.block}px`,
        borderRadius: 6,
        border: `1px solid ${DOC.border}`,
      }}
    />
  );
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => (
        <InlineNodeView key={i} node={node} />
      ))}
    </>
  );
}

function InlineNodeView({ node }: { node: InlineNode }) {
  switch (node.kind) {
    case 'text':
      return <>{node.value}</>;
    case 'bold':
      return (
        <strong style={{ fontWeight: 700 }}>
          <Inline nodes={node.children} />
        </strong>
      );
    case 'italic':
      return (
        <em>
          <Inline nodes={node.children} />
        </em>
      );
    case 'code':
      return (
        <code
          style={{
            padding: '1px 5px',
            background: DOC.input,
            borderRadius: 4,
            fontSize: '0.88em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: DOC.link,
          }}
        >
          {node.value}
        </code>
      );
    case 'link':
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: DOC.link, textDecoration: 'none' }}
        >
          <Inline nodes={node.children} />
        </a>
      );
    case 'image':
      return <DocImage src={node.src} alt={node.alt} />;
    default:
      return null;
  }
}
