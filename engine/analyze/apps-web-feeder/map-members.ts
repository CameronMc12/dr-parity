/**
 * Map ClickUp export members + assignees into the apps/web Member/Assignee
 * shapes. ClickUp uses numeric user ids; apps/web stores them as strings.
 */

import type {
  ExportAssignee,
  ExportMemberEntry,
  TargetAssignee,
  TargetMember,
} from './types';

const FALLBACK_COLOR = '#595d66';

/** Derive initials from a display name when the export omits them. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map a single export assignee (task-level) to the lean apps/web Assignee. */
export function mapAssignee(a: ExportAssignee): TargetAssignee {
  const name = a.username ?? 'Unknown';
  return {
    id: String(a.id),
    name,
    initials: a.initials || deriveInitials(name),
    color: a.color || FALLBACK_COLOR,
  };
}

/** Map the workspace members list to the apps/web Member[] (owner-first). */
export function mapMembers(members: ExportMemberEntry[]): TargetMember[] {
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('Export members list is empty — cannot derive workspace owner');
  }
  return members.map((entry) => {
    const u = entry.user;
    if (!u || u.id == null) {
      throw new Error('Malformed member entry: missing user.id');
    }
    const name = u.username ?? 'Unknown';
    return {
      id: String(u.id),
      name,
      initials: u.initials || deriveInitials(name),
      color: u.color || FALLBACK_COLOR,
      email: u.email ?? '',
      roleKey: u.role_key ?? 'member',
    };
  });
}
