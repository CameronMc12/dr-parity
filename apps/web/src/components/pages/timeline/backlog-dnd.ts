/**
 * Shared MIME type for the Timeline backlog drag-and-drop. The Backlog panel
 * writes the dragged task id under this custom type so the chart's drop handler
 * can recognise a backlog drag (and ignore unrelated drags) before reading it.
 */
export const BACKLOG_DND_MIME = 'application/x-clickup-backlog-task';
