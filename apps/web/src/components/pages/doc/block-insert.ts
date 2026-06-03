/**
 * Block-insert helpers. The doc editor's content is raw markdown (see
 * `doc-data.ts`), so "inserting a block" means appending the markdown that the
 * read-only renderer (`MarkdownBody`) knows how to draw. Each builder returns a
 * self-contained snippet; the caller concatenates it onto the page body and
 * flips into editing so the caret lands inside the new block.
 *
 * `BlockType` is the shared vocabulary for the slash menu and the empty-state
 * starters, so both surfaces insert identical markup.
 */

export type BlockType =
  | 'table'
  | 'columns'
  | 'list'
  | 'subpage'
  | 'heading'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'divider'
  | 'checklist';

interface BlockSnippet {
  /** Markdown to append to the page body. */
  markdown: string;
}

/**
 * Build the markdown for a block. `listName` seeds the embedded-list block so it
 * reads as a real ClickUp List reference rather than a placeholder.
 */
export function buildBlock(type: BlockType, listName = 'Tasks'): BlockSnippet {
  switch (type) {
    case 'table':
      return {
        markdown: [
          '| Column 1 | Column 2 | Column 3 |',
          '| --- | --- | --- |',
          '|  |  |  |',
          '|  |  |  |',
        ].join('\n'),
      };
    case 'columns':
      // Two-column block rendered as a side-by-side table shell (the renderer has
      // no native column primitive; a 2-cell table is the closest visual match).
      return {
        markdown: ['| Left column | Right column |', '| --- | --- |', '|  |  |'].join('\n'),
      };
    case 'list':
      return {
        markdown: [
          `> 📋 **${listName}** — embedded ClickUp List`,
          '',
          '- [ ] First task',
          '- [ ] Second task',
          '- [ ] Third task',
        ].join('\n'),
      };
    case 'subpage':
      // The subpage block links to the freshly-created tree page; the caller
      // creates that page and supplies its name via `listName`.
      return { markdown: `📄 **${listName}**` };
    case 'heading':
      return { markdown: '# Heading' };
    case 'bullet':
      return { markdown: '- List item' };
    case 'numbered':
      return { markdown: '1. List item' };
    case 'quote':
      return { markdown: '> Quote' };
    case 'divider':
      return { markdown: '---' };
    case 'checklist':
      return { markdown: '- [ ] To-do' };
    default:
      return { markdown: '' };
  }
}

/** Append a block to an existing body with correct blank-line separation. */
export function appendBlock(body: string, snippet: BlockSnippet): string {
  const trimmed = body.replace(/\s+$/, '');
  if (trimmed.length === 0) return snippet.markdown;
  return `${trimmed}\n\n${snippet.markdown}`;
}
