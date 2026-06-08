'use client';

/**
 * Doc view. Page-tree sidebar + a ClickUp-1:1 doc reader/editor rendering REAL
 * crawled ClickUp doc bodies (markdown). Bodies come from `getDocPages` /
 * `getDocPage`; the sidebar tree from `docs-tree.json`. The body renders
 * read-only via `MarkdownBody`, or as an editable raw-markdown surface
 * (`DocEditor`) with a slash menu + format toolbar. Title/body/new-subpage edits
 * are held in component state, keyed by page id, so switching pages preserves
 * unsaved work.
 *
 * Contract (do not change the export name or props):
 *   route /<wsId>/v/dc/:docId/:pageId?  ->  <DocView docId=… pageId=… />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewScope } from '@/lib/view-scope';
import { DOCS_TREE } from '@/data/docs-tree';
import { getDocPage, getDocPages, type DocPage } from '@/lib/view-data';
import { useMembers, useCurrentMemberId } from '@/store/workspace/hooks';
import { appendBlock, buildBlock, type BlockType } from './block-insert';
import { type ExtraPage } from './DocSidebar';
import { DocPageTree } from './DocPageTree';
import { DocHeader } from './DocHeader';
import { DocEditor, type DocEditorHandle } from './DocEditor';
import { DocToolbar, type DocWidth } from './DocToolbar';
import { DocStarter } from './DocStarter';
import { MarkdownBody } from './MarkdownBody';
import { PageStackIcon, LinkIcon } from './doc-icons';
import { clockUpdated } from './relative-time';
import { DOC } from './tokens';

type PageEdit = Pick<DocPage, 'name' | 'content'>;

const WIDTH_PX: Record<DocWidth, number> = {
  small: 680,
  default: DOC.contentMaxWidth,
  large: 1040,
};

export function DocView({
  docId = '',
  pageId,
  // A Doc is page-content, not list-task content, so it renders identically for
  // any scope. The prop is accepted so a space/folder route can mount a Doc view
  // through ScopeViewRoute without diverging from the list-route DocView.
  scope: _scope,
}: {
  docId?: string;
  pageId?: string;
  scope?: ViewScope;
}) {
  const [activeDocId, setActiveDocId] = useState(docId);
  const [activePageId, setActivePageId] = useState<string | undefined>(pageId);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, PageEdit>>({});
  // ClickUp opens a doc with the page-tree rail expanded (oracle: seed-view-doc);
  // the "pages" pill toggles it.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState<DocWidth>('default');
  const [serif, setSerif] = useState(false);
  // In-memory subpages created via the starter / slash menu, keyed by doc id.
  const [extraPages, setExtraPages] = useState<Record<string, ExtraPage[]>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const editorRef = useRef<DocEditorHandle>(null);
  const subpageSeq = useRef(0);
  const toastTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const members = useMembers();
  const currentMemberId = useCurrentMemberId();
  const author = useMemo(
    () => members.find((m) => m.id === currentMemberId) ?? members[0],
    [members, currentMemberId],
  );

  useEffect(() => {
    setActiveDocId(docId);
    setActivePageId(pageId);
  }, [docId, pageId]);

  const doc = getDocPages(activeDocId);
  const page = getDocPage(activeDocId, activePageId);
  const docNode = useMemo(
    () => DOCS_TREE.find((d) => d.id === activeDocId),
    [activeDocId],
  );

  const docExtras = useMemo(
    () => extraPages[activeDocId] ?? [],
    [extraPages, activeDocId],
  );
  const extraActive = useMemo(
    () => docExtras.find((p) => p.id === activePageId),
    [docExtras, activePageId],
  );

  const sourceName = extraActive?.name ?? page?.name ?? 'Untitled';
  const sourceContent = extraActive?.content ?? page?.content ?? '';
  const editKey = extraActive?.id ?? page?.id;
  const edit = editKey ? edits[editKey] : undefined;
  const title = edit?.name ?? sourceName;
  const body = edit?.content ?? sourceContent;

  const pageCount =
    (doc?.pages.length ?? (docNode ? 1 : 0)) + docExtras.length;
  const hasPage = Boolean(extraActive || (doc && page));
  // ClickUp centres the title/author/starter only on a fresh empty page.
  const isEmptyBody = !editing && body.trim().length === 0;

  const select = useCallback((nextDocId: string, nextPageId?: string) => {
    setActiveDocId(nextDocId);
    setActivePageId(nextPageId);
    setEditing(false);
  }, []);

  const patchEdit = useCallback(
    (patch: Partial<PageEdit>) => {
      if (!editKey) return;
      setEdits((prev) => {
        const base = prev[editKey] ?? { name: sourceName, content: sourceContent };
        return { ...prev, [editKey]: { ...base, ...patch } };
      });
    },
    [editKey, sourceName, sourceContent],
  );

  // Side-effect for tree-affecting blocks. Returns the label that seeds the
  // inserted markdown (the subpage name). Inline blocks return undefined.
  const sideEffectForBlock = useCallback(
    (block: BlockType): string | undefined => {
      if (block !== 'subpage') return undefined;
      subpageSeq.current += 1;
      const id = `extra-${activeDocId}-${subpageSeq.current}`;
      const name = `Subpage ${subpageSeq.current}`;
      setExtraPages((prev) => {
        const list = prev[activeDocId] ?? [];
        return { ...prev, [activeDocId]: [...list, { id, name, content: '' }] };
      });
      return name;
    },
    [activeDocId],
  );

  // Insert a block by appending its markdown to the body, then drop into edit
  // mode so the caret lands in the doc. Subpages also mint a tree node.
  const insertBlock = useCallback(
    (block: BlockType) => {
      const label = sideEffectForBlock(block);
      const snippet = buildBlock(block, label);
      patchEdit({ content: appendBlock(body, snippet) });
      setEditing(true);
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [body, patchEdit, sideEffectForBlock],
  );

  const startWriting = useCallback(() => {
    setEditing(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  // Page-tree "Add page": mint a fresh in-session subpage and switch to it.
  const addPage = useCallback(() => {
    subpageSeq.current += 1;
    const id = `extra-${activeDocId}-${subpageSeq.current}`;
    const name = `Untitled page ${subpageSeq.current}`;
    setExtraPages((prev) => {
      const list = prev[activeDocId] ?? [];
      return { ...prev, [activeDocId]: [...list, { id, name, content: '' }] };
    });
    setActivePageId(id);
    setEditing(false);
  }, [activeDocId]);

  const blankWiki = useCallback(() => {
    sideEffectForBlock('subpage');
    patchEdit({ content: appendBlock(body, buildBlock('heading')) });
    setEditing(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [sideEffectForBlock, patchEdit, body]);

  const writeWithAi = useCallback(
    (prompt: string) => {
      const drafted = `## ${prompt}\n\nHere's a starting draft based on "${prompt}". Edit freely.`;
      if (editing) {
        editorRef.current?.appendText(drafted);
      } else {
        patchEdit({ content: appendBlock(body, { markdown: drafted }) });
        setEditing(true);
        requestAnimationFrame(() => editorRef.current?.focus());
      }
    },
    [editing, body, patchEdit],
  );

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  // Templates rail: seed the body with a real heading skeleton, then edit.
  const insertTemplate = useCallback(
    (name: string) => {
      const skeleton = `# ${name}\n\n## Overview\n\nWrite a short summary here.\n\n## Details\n\n- Key point one\n- Key point two\n\n## Next steps\n\n1. First action\n2. Second action`;
      patchEdit({ content: appendBlock(body, { markdown: skeleton }) });
      setEditing(true);
      requestAnimationFrame(() => editorRef.current?.focus());
      toast(`Inserted "${name}" template`);
    },
    [body, patchEdit, toast],
  );

  // Clone the active page (source or extra) into a fresh in-session subpage.
  const duplicatePage = useCallback(() => {
    subpageSeq.current += 1;
    const id = `extra-${activeDocId}-${subpageSeq.current}`;
    const name = `${title} (copy)`;
    const content = body;
    setExtraPages((prev) => {
      const list = prev[activeDocId] ?? [];
      return { ...prev, [activeDocId]: [...list, { id, name, content }] };
    });
    setActivePageId(id);
    setEditing(false);
    toast('Page duplicated');
  }, [activeDocId, title, body, toast]);

  // Delete only works on in-session subpages; source pages are read-only mirrors.
  const deletePage = useCallback(() => {
    if (!extraActive) {
      toast('Source pages can’t be deleted in the offline clone');
      return;
    }
    const removedId = extraActive.id;
    setExtraPages((prev) => {
      const list = prev[activeDocId] ?? [];
      return { ...prev, [activeDocId]: list.filter((p) => p.id !== removedId) };
    });
    setEdits((prev) => {
      if (!(removedId in prev)) return prev;
      const next = { ...prev };
      delete next[removedId];
      return next;
    });
    setActivePageId(page?.id);
    setEditing(false);
    toast('Page deleted');
  }, [activeDocId, extraActive, page, toast]);

  // Offline download: render the current markdown body to a file via a Blob.
  const downloadDoc = useCallback(
    (format: 'markdown' | 'html' | 'pdf') => {
      if (format === 'pdf') {
        toast('PDF export needs a live backend');
        return;
      }
      const safeTitle = title.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'doc';
      const isHtml = format === 'html';
      const text = isHtml
        ? `<!doctype html>\n<meta charset="utf-8">\n<title>${title}</title>\n<pre>${body
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</pre>\n`
        : `# ${title}\n\n${body}`;
      const mime = isHtml ? 'text/html' : 'text/markdown';
      const ext = isHtml ? 'html' : 'md';
      const blob = new Blob([text], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`Downloaded ${ext.toUpperCase()}`);
    },
    [title, body, toast],
  );

  const favorite = Boolean(favorites[activeDocId]);
  const lastUpdated = extraActive ? null : page?.dateUpdated ?? null;
  const columnWidth = WIDTH_PX[width];

  return (
    <div
      data-testid="doc-view"
      style={{ display: 'flex', height: '100%', overflow: 'hidden', background: DOC.bg }}
    >
      {sidebarOpen && (
        <DocPageTree
          docId={activeDocId}
          pageId={activePageId}
          extraPages={docExtras}
          onSelect={select}
          onAddPage={addPage}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <DocHeader
          favorite={favorite}
          onToggleFavorite={() =>
            setFavorites((prev) => ({ ...prev, [activeDocId]: !prev[activeDocId] }))
          }
          onCopyLink={() => copyLink(activeDocId, activePageId)}
          onShare={() => {
            copyLink(activeDocId, activePageId);
            toast('Share link copied');
          }}
          onMove={() => toast('Move needs a live backend')}
          onDuplicate={duplicatePage}
          onDelete={deletePage}
          onAddTag={() => toast('Tags need a live backend')}
          onManageTags={() => toast('Tags need a live backend')}
        />

        <div
          data-testid="doc-scroll"
          style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ padding: '24px 32px 120px' }}>
            <div style={{ maxWidth: columnWidth, margin: '0 auto' }}>
              <PagesPill
                count={pageCount}
                open={sidebarOpen}
                onToggle={() => setSidebarOpen((v) => !v)}
              />

              {!hasPage ? (
                <EmptyDoc />
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isEmptyBody ? 'center' : 'stretch',
                      textAlign: isEmptyBody ? 'center' : 'left',
                    }}
                  >
                    <LinkAffordance onClick={startWriting} />
                    <DocTitle
                      value={title}
                      editing={editing}
                      serif={serif}
                      centered={isEmptyBody}
                      placeholder={isEmptyBody && title === 'Untitled'}
                      onChange={(name) => patchEdit({ name })}
                    />
                    <AuthorRow
                      name={author?.name ?? 'You'}
                      initials={author?.initials ?? 'YO'}
                      color={author?.color}
                      updated={lastUpdated}
                    />
                  </div>

                  {editing ? (
                    <DocEditor
                      ref={editorRef}
                      value={body}
                      onChange={(content) => patchEdit({ content })}
                      onBlockSideEffect={sideEffectForBlock}
                    />
                  ) : body.trim().length > 0 ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={startWriting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') startWriting();
                      }}
                      style={{
                        cursor: 'text',
                        fontFamily: serif ? 'Georgia, "Times New Roman", serif' : undefined,
                      }}
                    >
                      <MarkdownBody content={body} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: 280, textAlign: 'left' }}>
                        <DocStarter
                          onStartWriting={startWriting}
                          onBlankWiki={blankWiki}
                          onWriteWithAi={() => writeWithAi('Outline this page')}
                          onInsertBlock={insertBlock}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DocToolbar
            width={width}
            onWidthChange={setWidth}
            serif={serif}
            onSerifChange={setSerif}
            onComment={startWriting}
            onAiWrite={writeWithAi}
            onRelationships={() => toast('Linking needs a live backend')}
            onInsertTemplate={insertTemplate}
            onDownload={downloadDoc}
          />
        </div>
      </div>

      {toastMsg && <DocToast message={toastMsg} />}
    </div>
  );
}

function DocToast({ message }: { message: string }) {
  return (
    <div
      data-testid="doc-toast"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '10px 16px',
        background: DOC.textPrimary,
        color: '#fff',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: 'var(--cu-shadow-lg)',
        animation: 'docToastIn 140ms ease',
      }}
    >
      {message}
      <style>{`@keyframes docToastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}

function copyLink(docId: string, pageId?: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  const path = pageId ? `${docId}/${pageId}` : docId;
  void navigator.clipboard.writeText(`${window.location.origin}/v/dc/${path}`);
}

function PagesPill({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="doc-pages-pill"
      aria-pressed={open}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 8px',
        marginBottom: 16,
        background: hover ? DOC.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: DOC.textSecondary,
        fontSize: 13,
        fontWeight: 400,
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <PageStackIcon size={14} />
      {count} {count === 1 ? 'page' : 'pages'}
    </button>
  );
}

function LinkAffordance({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="doc-link-affordance"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 6px',
        marginBottom: 10,
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: hover ? DOC.textSecondary : DOC.textMuted,
        fontSize: 12.5,
        fontFamily: 'inherit',
        transition: 'color 120ms ease',
      }}
    >
      <LinkIcon size={14} />
      Link Task or Doc
    </button>
  );
}

function DocTitle({
  value,
  editing,
  serif,
  centered,
  placeholder = false,
  onChange,
}: {
  value: string;
  editing: boolean;
  serif: boolean;
  centered: boolean;
  placeholder?: boolean;
  onChange: (next: string) => void;
}) {
  const style = {
    display: 'block',
    width: '100%',
    margin: '0 0 12px',
    padding: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    // Fresh empty docs show the title as a muted placeholder, like ClickUp.
    color: placeholder ? DOC.textMuted : DOC.textPrimary,
    fontFamily: serif ? 'Georgia, "Times New Roman", serif' : DOC.headingFont,
    fontSize: 38,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
    textAlign: (centered ? 'center' : 'left') as 'center' | 'left',
    boxSizing: 'border-box' as const,
  };
  if (editing) {
    return (
      <input
        data-testid="doc-title-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Untitled"
        style={style}
      />
    );
  }
  return (
    <h1 data-testid="doc-title" style={{ ...style, margin: '0 0 12px' }}>
      {value}
    </h1>
  );
}

function AuthorRow({
  name,
  initials,
  color,
  updated,
}: {
  name: string;
  initials: string;
  color?: string;
  updated: number | null;
}) {
  return (
    <div
      data-testid="doc-author-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 0 24px',
        fontSize: 13,
        color: DOC.textMuted,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color ?? 'var(--cu-accent)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
      <span style={{ color: DOC.textSecondary, fontWeight: 500 }}>{name}</span>
      <span style={{ color: DOC.textMuted }}>·</span>
      <span>Last updated {clockUpdated(updated)}</span>
    </div>
  );
}

function EmptyDoc() {
  return (
    <div data-testid="doc-empty" style={{ paddingTop: 12 }}>
      <h1
        style={{
          margin: '0 0 12px',
          fontFamily: DOC.headingFont,
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: DOC.textPrimary,
        }}
      >
        Untitled
      </h1>
      <p style={{ color: DOC.textMuted, fontSize: 14 }}>This doc has no content yet.</p>
    </div>
  );
}
