'use client';

/**
 * Active embed surface: slim URL bar + sandboxed iframe filling the content
 * area. Supports both source kinds:
 *   - "url"  → iframe `src`     (display = host + path)
 *   - "html" → iframe `srcDoc`  (display = "Embedded HTML")
 *
 * Reload is a real key-remount of the iframe. Some sites refuse framing
 * (X-Frame-Options / frame-ancestors); the browser cannot reliably surface that
 * as an `onError`, so we also watch a load timeout and offer an explicit
 * open-in-new-tab fallback alongside the live frame (URL sources only).
 */

import { useEffect, useRef, useState } from 'react';
import { normalizeEmbedUrl } from './embed-url';
import { EmbedUrlBar } from './EmbedUrlBar';
import { EmbedBlockedNote } from './EmbedBlockedNote';
import { EMBED } from './tokens';
import type { EmbedSource } from './EmbedSourceConfig';

/** Sites have this long to fire `load` before we surface the framing-blocked note. */
const LOAD_TIMEOUT_MS = 6000;

export function EmbedFrame({
  source,
  onEdit,
}: {
  source: EmbedSource;
  onEdit: () => void;
}) {
  // Bumping this key remounts the iframe → a true reload, even to the same src.
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [maybeBlocked, setMaybeBlocked] = useState(false);
  const timerRef = useRef<number | null>(null);

  const isUrl = source.kind === 'url';
  const href = isUrl ? source.value : '';
  const display = isUrl ? normalizeEmbedUrl(source.value)?.display ?? source.value : 'Embedded HTML';

  useEffect(() => {
    setLoaded(false);
    setMaybeBlocked(false);
    // Only URL sources can be framing-blocked; srcDoc always loads.
    if (!isUrl) return;
    timerRef.current = window.setTimeout(() => setMaybeBlocked(true), LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [source.value, reloadKey, isUrl]);

  const handleLoad = () => {
    setLoaded(true);
    setMaybeBlocked(false);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  };

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div
      data-testid="embed-frame"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: EMBED.bg }}
    >
      <EmbedUrlBar display={display} href={href} isUrl={isUrl} onReload={reload} onEdit={onEdit} />

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <iframe
          key={reloadKey}
          data-testid="embed-iframe"
          {...(isUrl ? { src: source.value } : { srcDoc: source.value })}
          title={`Embedded: ${display}`}
          onLoad={handleLoad}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: '#fff',
          }}
        />

        {isUrl && maybeBlocked && !loaded && <EmbedBlockedNote href={href} onRetry={reload} />}
      </div>
    </div>
  );
}
