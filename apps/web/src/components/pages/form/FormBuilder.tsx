'use client';

/**
 * The Form builder body: the left "Fields" rail + the centered live preview
 * whose Submit creates a REAL task in the list. Initial title/description/field
 * set come from the chosen template (or blank for "scratch"); a "change
 * template" affordance lets the user return to the chooser.
 *
 * Mounted with a React `key` tied to the chosen template, so re-selecting a
 * template remounts this component and its lazy useState initializers run fresh.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { useWorkspaceStore } from '@/store/workspace';
import { useListTasksFlat, useMembers } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import { listStatusOptions, PRIORITY_OPTIONS } from '@/components/pages/listview/statuses';
import {
  defaultDropdownChoices,
  emptyDraft,
  validateDraft,
  type FieldKey,
  type FormDraft,
} from './form-fields';
import { findTemplate, type TemplateId } from './form-templates';
import { FieldsRail } from './FieldsRail';
import { FormPreview } from './FormPreview';
import { FormSuccess } from './FormSuccess';
import { ChangeTemplateBar } from './ChangeTemplateBar';
import { FORM_TOKENS as T } from './tokens';

interface BuilderSeed {
  title: string;
  description: string;
  fields: FieldKey[];
  dropdownChoices: string[];
}

/** Derive the builder's initial state from the chosen template id. */
function seedFor(template: TemplateId): BuilderSeed {
  const tpl = template === 'scratch' ? undefined : findTemplate(template);
  if (!tpl) {
    return {
      title: 'Untitled Form',
      description: '',
      fields: ['name', 'description', 'assignee', 'priority', 'dueDate', 'status'],
      dropdownChoices: defaultDropdownChoices(),
    };
  }
  return {
    title: tpl.title,
    description: tpl.description,
    fields: [...tpl.fields],
    dropdownChoices: tpl.dropdownChoices ? [...tpl.dropdownChoices] : defaultDropdownChoices(),
  };
}

export function FormBuilder({
  listId,
  template,
  onChangeTemplate,
}: {
  listId: string;
  template: TemplateId;
  onChangeTemplate: () => void;
}) {
  const members = useMembers();
  const flatTasks = useListTasksFlat(listId);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const updateTask = useWorkspaceStore((s) => s.updateTask);

  const seed = useMemo(() => seedFor(template), [template]);

  const [title, setTitle] = useState(seed.title);
  const [description, setDescription] = useState(seed.description);
  const [activeFields, setActiveFields] = useState<FieldKey[]>(seed.fields);
  const [dropdownChoices, setDropdownChoices] = useState<string[]>(seed.dropdownChoices);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitted, setSubmitted] = useState<Task | null>(null);

  const statusOptions = useMemo(() => listStatusOptions(flatTasks), [flatTasks]);
  const { onContextMenu, menu } = useTaskContextMenu();

  const addField = useCallback((key: FieldKey) => {
    setActiveFields((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const removeField = useCallback((key: FieldKey) => {
    setActiveFields((prev) => prev.filter((k) => k !== key));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const found = validateDraft(draft, activeFields);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    const priorityColor = draft.priority
      ? PRIORITY_OPTIONS.find((p) => p.key === draft.priority)?.color ?? null
      : null;
    const created = createTask({
      name: draft.name.trim(),
      listId,
      assignees: draft.assignees,
      priority: draft.priority,
      priorityColor,
      dueDate: draft.dueDate,
      status: draft.status?.status,
      statusColor: draft.status?.statusColor,
      statusType: draft.status?.statusType,
    });
    if (draft.description.trim().length > 0) {
      updateTask(created.id, { description: draft.description.trim() });
    }
    setSubmitted(created);
  }, [draft, activeFields, createTask, updateTask, listId]);

  const handleReset = useCallback(() => {
    setDraft(emptyDraft());
    setErrors({});
    setSubmitted(null);
  }, []);

  const fieldContextMenu = useCallback(
    (_key: FieldKey) => (e: React.MouseEvent) => {
      if (submitted) onContextMenu(e, submitted);
    },
    [submitted, onContextMenu],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ChangeTemplateBar template={template} onChangeTemplate={onChangeTemplate} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, background: T.bgApp, fontFamily: T.font }}>
        <FieldsRail active={activeFields} onAdd={addField} onRemove={removeField} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            padding: '40px 32px 80px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 640 }}>
            {submitted ? (
              <div onContextMenu={(e) => onContextMenu(e, submitted)}>
                <FormSuccess title={title} createdName={submitted.name} onReset={handleReset} />
              </div>
            ) : (
              <FormPreview
                title={title}
                description={description}
                onTitleChange={setTitle}
                onDescriptionChange={setDescription}
                activeFields={activeFields}
                draft={draft}
                setDraft={setDraft}
                errors={errors}
                members={members}
                statusOptions={statusOptions}
                dropdownChoices={dropdownChoices}
                onDropdownChoicesChange={setDropdownChoices}
                onRemoveField={removeField}
                onSubmit={handleSubmit}
                onFieldContextMenu={fieldContextMenu}
              />
            )}
          </div>
        </div>
      </div>
      {menu}
    </div>
  );
}
