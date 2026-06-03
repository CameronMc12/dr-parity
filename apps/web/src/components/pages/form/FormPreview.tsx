'use client';

/**
 * Centered live form-preview card. Editable title + description over a coloured
 * cover, then each active field rendered as a real input. Submitting runs
 * validation upstream; the Submit button reflects busy state.
 */

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Member } from '@/store/workspace/types';
import type { StatusOption } from '@/components/pages/listview/statuses';
import type { FieldKey, FormDraft } from './form-fields';
import { fieldDef } from './form-fields';
import { FormFieldRow } from './FormFieldRow';
import { ChoicesEditor } from './ChoicesEditor';
import {
  AssigneePicker,
  ChoiceSelect,
  DateInput,
  PrioritySelect,
  StatusSelect,
  TextAreaInput,
  TextInput,
} from './FormInputs';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

export interface FormPreviewProps {
  title: string;
  description: string;
  onTitleChange: (next: string) => void;
  onDescriptionChange: (next: string) => void;
  activeFields: FieldKey[];
  draft: FormDraft;
  setDraft: Dispatch<SetStateAction<FormDraft>>;
  errors: Partial<Record<FieldKey, string>>;
  members: Member[];
  statusOptions: StatusOption[];
  dropdownChoices: string[];
  onDropdownChoicesChange: (next: string[]) => void;
  onRemoveField: (key: FieldKey) => void;
  onSubmit: () => void;
  onFieldContextMenu?: (key: FieldKey) => (e: React.MouseEvent) => void;
}

export function FormPreview(props: FormPreviewProps) {
  const { title, description, onTitleChange, onDescriptionChange, activeFields } = props;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 640,
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        boxShadow: T.shadowMd,
        overflow: 'hidden',
      }}
    >
      <FormCover />
      <div style={{ padding: '20px 32px 8px' }}>
        <TitleInput value={title} onChange={onTitleChange} />
        <DescriptionInput value={description} onChange={onDescriptionChange} />
      </div>
      <div style={{ height: 1, background: T.borderDivider, margin: '0 32px' }} />
      <div style={{ padding: '24px 32px 8px' }}>
        {activeFields.map((key) => (
          <FieldRenderer key={key} fieldKey={key} {...props} />
        ))}
      </div>
      <div style={{ padding: '8px 32px 32px' }}>
        <SubmitButton onClick={props.onSubmit} />
      </div>
    </div>
  );
}

function FormCover() {
  return (
    <div
      style={{
        height: 96,
        background: `linear-gradient(120deg, ${T.accentDark}, ${T.accent})`,
      }}
    />
  );
}

function TitleInput({ value, onChange }: { value: string; onChange: (n: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Form title"
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        outline: 'none',
        color: T.textPrimary,
        fontFamily: T.font,
        fontSize: 22,
        fontWeight: 700,
        padding: 0,
        marginBottom: 4,
      }}
    />
  );
}

function DescriptionInput({ value, onChange }: { value: string; onChange: (n: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Add a description for this form"
      rows={2}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        outline: 'none',
        color: T.textSecondary,
        fontFamily: T.font,
        fontSize: 14,
        lineHeight: 1.5,
        padding: 0,
        resize: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function FieldRenderer({ fieldKey, ...p }: FormPreviewProps & { fieldKey: FieldKey }) {
  const removable = !fieldDef(fieldKey).locked;
  return (
    <FormFieldRow
      fieldKey={fieldKey}
      error={p.errors[fieldKey]}
      removable={removable}
      onRemove={() => p.onRemoveField(fieldKey)}
      onContextMenu={p.onFieldContextMenu?.(fieldKey)}
    >
      <FieldControl fieldKey={fieldKey} {...p} />
    </FormFieldRow>
  );
}

function FieldControl({
  fieldKey,
  draft,
  setDraft,
  errors,
  members,
  statusOptions,
  dropdownChoices,
  onDropdownChoicesChange,
}: FormPreviewProps & { fieldKey: FieldKey }) {
  switch (fieldKey) {
    case 'name':
      return (
        <TextInput
          value={draft.name}
          onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          placeholder="Enter a task name"
          error={Boolean(errors.name)}
        />
      );
    case 'description':
      return (
        <TextAreaInput
          value={draft.description}
          onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
          placeholder="Add more detail"
        />
      );
    case 'assignee':
      return (
        <AssigneePicker
          members={members}
          value={draft.assignees}
          onChange={(v) => setDraft((d) => ({ ...d, assignees: v }))}
        />
      );
    case 'priority':
      return <PrioritySelect value={draft.priority} onChange={(v) => setDraft((d) => ({ ...d, priority: v }))} />;
    case 'dueDate':
      return <DateInput value={draft.dueDate} onChange={(v) => setDraft((d) => ({ ...d, dueDate: v }))} />;
    case 'status':
      return (
        <StatusSelect
          options={statusOptions}
          value={draft.status}
          onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
        />
      );
    case 'email':
      return (
        <TextInput
          type="email"
          value={draft.email}
          onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
          placeholder="name@company.com"
          error={Boolean(errors.email)}
        />
      );
    case 'dropdown':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ChoiceSelect
            choices={dropdownChoices}
            value={draft.dropdown}
            onChange={(v) => setDraft((d) => ({ ...d, dropdown: v }))}
            placeholder="Select an option"
          />
          <ChoicesEditor
            choices={dropdownChoices}
            onChange={(next) => {
              onDropdownChoicesChange(next);
              if (draft.dropdown != null && !next.includes(draft.dropdown)) {
                setDraft((d) => ({ ...d, dropdown: null }));
              }
            }}
          />
        </div>
      );
    default:
      return null;
  }
}

function SubmitButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 44,
        borderRadius: T.radiusMd,
        border: 'none',
        background: hover ? T.accentDark : T.accent,
        color: '#fff',
        fontFamily: T.font,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        transition: HOVER_TRANSITION,
      }}
    >
      Submit
    </button>
  );
}
