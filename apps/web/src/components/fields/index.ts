/**
 * Shared FIELDS / custom-column system. The Table and List views consume these
 * to add, render, edit, and manage custom-field columns.
 *
 *   FieldsPanel       — the "Add a Column / Fields" picker popover.
 *   CustomFieldHeader — a custom-field column header (icon + name + kebab menu).
 *   CustomFieldCell   — renders + edits one task's value for one field.
 *
 * The catalog (field types, icons, presets) is re-exported for any view that
 * wants to surface a field-type icon or label outside the panel.
 */

export { FieldsPanel } from './FieldsPanel';
export { CustomFieldHeader } from './CustomFieldHeader';
export { CustomFieldCell } from './CustomFieldCell';

export {
  FieldTypeIcon,
  typeLabel,
  ALL_TYPES,
  AI_TYPES,
  SUGGESTED_PRESETS,
  TYPE_COLORS,
  type FieldTypeEntry,
  type FieldPreset,
} from './field-catalog';
