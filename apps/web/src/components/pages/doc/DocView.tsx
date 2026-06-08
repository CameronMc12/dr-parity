'use client';

/**
 * Doc view. Page-tree sidebar + a ClickUp-1:1 doc reader/editor rendering REAL
 * crawled ClickUp doc bodies (markdown). Docs are read from the persisted docs
 * store (`docs.slice`), seeded from the research export. The body renders
 * read-only via `MarkdownBody`, or as an editable raw-markdown surface
 * (`DocEditor`) with a slash menu + format toolbar. Title / body edits and
 * new / duplicated / deleted pages all mutate the store and persist to
 * localStorage, so changes survive reload and reflect in the hub and sidebar.
 *
 * Contract (do not change the export name or props):
 *   route /<wsId>/v/dc/:docId/:pageId?  ->  <DocView docId=… pageId=… />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewScope } from '@/lib/view-scope';
import {
  useDoc,
  useDocPage,
  useDocsHydration,
  useDocsStore,
} from '@/store/workspace/docs.slice';
import { useMembers, useCurrentMemberId } from '@/store/workspace/hooks';
import { appendBlock, buildBlock, type BlockType } from './block-insert';
import { DocPageTree } from './DocPageTree';
import { DocHeader } from './DocHeader';
import { DocEditor, type DocEditorHandle } from './DocEditor';
import { DocToolbar, type DocWidth } from './DocToolbar';
import { DocStarter } from './DocStarter';
import { MarkdownBody } from './MarkdownBody';
import { PageStackIcon, LinkIcon } from './doc-icons';
import { clockUpdated } from './relative-time';
import { DOC } from './tokens';

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
  useDocsHydration();
  const [activeDocId, setActiveDocId] = useState(docId);
  const [activePageId, setActivePageId] = useState<string | undefined>(pageId);
  const [editing, setEditing] = useState(false);
  // ClickUp opens a doc with the page-tree rail expanded (oracle: seed-view-doc);
  // the "pages" pill toggles it.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [width, setWidth] = useState<DocWidth>('default');
  const [serif, setSerif] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const editorRef = useRef<DocEditorHandle>(null);
  const toastTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const members = useMembers();
  const currentMemberId = useCurrentMemberId();
  const author = useMemo(
    () => members.find((m) => m.id === currentMemberId) ?? members[0],
    [members, currentMemberId],
  );

  // Store mutations — every edit persists through these.
  const renameDoc = useDocsStore((s) => s.renameDoc);
  const renamePage = useDocsStore((s) => s.renamePage);
  const setPageContent = useDocsStore((s) => s.setPageContent);
  const createPage = useDocsStore((s) => s.createPage);
  const duplicatePageAction = useDocsStore((s) => s.duplicatePage);
  const deletePageAction = useDocsStore((s) => s.deletePage);
  const toggleFavorite = useDocsStore((s) => s.toggleFavorite);

  useEffect(() => {
    setActiveDocId(docId);
    setActivePageId(pageId);
  }, [docId, pageId]);

  const doc = useDoc(activeDocId);
  const page = useDocPage(activeDocId, activePageId);
  // Resolve the page id even when the route omitted it (landing page).
  const resolvedPageId = page?.id;
  const isFirstPage = doc?.pages[0]?.id === resolvedPageId;

  const title = page?.name ?? doc?.name ?? 'Untitled';
  const body = page?.content ?? '';

  const pageCount = doc?.pages.length ?? 0;
  const hasPage = Boolean(doc && page);
  // ClickUp centres the title/author/starter only on a fresh empty page.
  const isEmptyBody = !editing && body.trim().length === 0;

  const select = useCallback((nextDocId: string, nextPageId?: string) => {
    setActiveDocId(nextDocId);
    setActivePageId(nextPageId);
    setEditing(false);
  }, []);

  // Title edits hit the doc name on the landing page, else the page name.
  const patchTitle = useCallback(
    (name: string) => {
      if (!doc || !resolvedPageId) return;
      if (isFirstPage) renameDoc(doc.id, name);
      else renamePage(doc.id, resolvedPageId, name);
    },
    [doc, resolvedPageId, isFirstPage, renameDoc, renamePage],
  );

  const patchBody = useCallback(
    (content: string) => {
      if (!doc || !resolvedPageId) return;
      setPageContent(doc.id, resolvedPageId, content);
    },
    [doc, resolvedPageId, setPageContent],
  );

  // Side-effect for tree-affecting blocks. Mints a real subpage in the store and
  // returns its name so the inserted markdown can reference it.
  const sideEffectForBlock = useCallback(
    (block: BlockType): string | undefined => {
      if (block !== 'subpage' || !doc) return undefined;
      const name = `Subpage ${doc.pages.length}`;
      createPage(doc.id, { name });
      return name;
    },
    [doc, createPage],
  );

  // Insert a block by appending its markdown to the body, then drop into edit
  // mode so the caret lands in the doc. Subpages also mint a tree node.
  const insertBlock = useCallback(
    (block: BlockType) => {
      const label = sideEffectForBlock(block);
      const snippet = buildBlock(block, label);
      patchBody(appendBlock(body, snippet));
      setEditing(true);
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [body, patchBody, sideEffectForBlock],
  );

  const startWriting = useCallback(() => {
    setEditing(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  // Page-tree "Add page": mint a fresh persisted page and switch to it.
  const addPage = useCallback(() => {
    if (!doc) return;
    const id = createPage(doc.id, { name: `Untitled page ${doc.pages.length + 1}` });
    if (id) {
      setActivePageId(id);
      setEditing(false);
    }
  }, [doc, createPage]);

  const blankWiki = useCallback(() => {
    sideEffectForBlock('subpage');
    patchBody(appendBlock(body, buildBlock('heading')));
    setEditing(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [sideEffectForBlock, patchBody, body]);

  const writeWithAi = useCallback(
    (prompt: string) => {
      const drafted = `## ${prompt}\n\nHere's a starting draft based on "${prompt}". Edit freely.`;
      if (editing) {
        editorRef.current?.appendText(drafted);
      } else {
        patchBody(appendBlock(body, { markdown: drafted }));
        setEditing(true);
        requestAnimationFrame(() => editorRef.current?.focus());
      }
    },
    [editing, body, patchBody],
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
      patchBody(appendBlock(body, { markdown: skeleton }));
      setEditing(true);
      requestAnimationFrame(() => editorRef.current?.focus());
      toast(`Inserted "${name}" template`);
    },
    [body, patchBody, toast],
  );

  // Clone the active page into a fresh persisted page and switch to it.
  const duplicatePage = useCallback(() => {
    if (!doc || !resolvedPageId) return;
    const id = duplicatePageAction(doc.id, resolvedPageId);
    if (id) {
      setActivePageId(id);
      setEditing(false);
      toast('Page duplicated');
    }
  }, [doc, resolvedPageId, duplicatePageAction, toast]);

  // Delete the active page. A doc must keep at least one page.
  const deletePage = useCallback(() => {
    if (!doc || !resolvedPageId) return;
    if (doc.pages.length <= 1) {
      toast('A doc must keep at least one page');
      return;
    }
    const nextId = doc.pages.find((p) => p.id !== resolvedPageId)?.id;
    deletePageAction(doc.id, resolvedPageId);
    setActivePageId(nextId);
    setEditing(false);
    toast('Page deleted');
  }, [doc, resolvedPageId, deletePageAction, toast]);

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

  const favorite = doc?.favorite ?? false;
  const lastUpdated = page?.dateUpdated ?? null;
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
          onSelect={select}
          onAddPage={addPage}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <DocHeader
          favorite={favorite}
          onToggleFavorite={() => toggleFavorite(activeDocId)}
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
                      onChange={patchTitle}
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
                      onChange={patchBody}
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
