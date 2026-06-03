'use client';

/**
 * The "Create a Form" onboarding screen, shown when a Form view has no template
 * choice yet. A centered heading + subtitle over a 3-column grid of template
 * cards, ending with a "Start from scratch" card. Selecting any card commits a
 * choice (lifted to FormView, which persists it and opens the builder).
 */

import { FORM_TEMPLATES, type TemplateId } from './form-templates';
import { TemplateCard, ScratchCard } from './TemplateCard';
import { FORM_TOKENS as T } from './tokens';

export function TemplateChooser({ onChoose }: { onChoose: (id: TemplateId) => void }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        background: T.bgApp,
        fontFamily: T.font,
        padding: '64px 32px 80px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 760, animation: 'cu-form-chooser-in 240ms ease-out' }}>
        <style>{`@keyframes cu-form-chooser-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.01em' }}>
            Create a Form
          </h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: T.textSecondary }}>
            Get started with a Form template or create a custom Form to fit your exact needs.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {FORM_TEMPLATES.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} onSelect={() => onChoose(tpl.id)} />
          ))}
          <ScratchCard onSelect={() => onChoose('scratch')} />
        </div>
      </div>
    </div>
  );
}
