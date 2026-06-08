'use client';

/**
 * Form view. ClickUp's "Create a Form" flow: a view with no chosen template
 * shows the centered template chooser (Feedback / Project Intake / Order /
 * Job Application / IT Requests + Start from scratch). Picking one persists the
 * choice per viewId and opens the builder pre-filled with that template's title
 * and field set; "Start from scratch" opens a blank builder.
 *
 * The builder itself (left Fields rail + centered live preview whose Submit
 * creates a REAL task in the list) lives in FormBuilder. This view only wires
 * the chooser, the persisted choice, and the "change template" round-trip.
 *
 * Owns the `form/` folder. Renders shared chrome (ViewShell + ViewToolbar).
 * Route: /<wsId>/v/form/:viewId  ->  <FormView viewId=… />
 */

import { useCallback } from 'react';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { resolveViewListId } from '@/lib/view-data';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeListToken } from '@/lib/view-scope';
import type { TemplateId } from './form-templates';
import { useFormChoice, useFormChoiceStore } from './form-choice-store';
import { TemplateChooser } from './TemplateChooser';
import { FormBuilder } from './FormBuilder';

export function FormView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  const effectiveScope: ViewScope = scope ?? { kind: 'list', listId: resolveViewListId(viewId) };
  // Form submit creates a real task in a concrete list (scope's default list).
  const listId = resolveViewListId(useScopeListToken(effectiveScope, viewId));
  const choice = useFormChoice(viewId);
  const setChoice = useFormChoiceStore((s) => s.setChoice);
  const clearChoice = useFormChoiceStore((s) => s.clearChoice);

  const handleChoose = useCallback(
    (id: TemplateId) => setChoice(viewId, id),
    [setChoice, viewId],
  );
  const handleChangeTemplate = useCallback(() => clearChoice(viewId), [clearChoice, viewId]);

  return (
    <ViewShell code="form" viewId={viewId}>
      <ViewToolbar listId={listId} viewId={viewId} controls={['customize']} />
      {choice == null ? (
        <TemplateChooser onChoose={handleChoose} />
      ) : (
        <FormBuilder
          key={choice}
          listId={listId}
          template={choice}
          onChangeTemplate={handleChangeTemplate}
        />
      )}
    </ViewShell>
  );
}
