/**
 * Self-contained seed data for the Teams / People management hub.
 * Local fixtures only — no backend. Mirrors the shape ClickUp uses on its
 * "Manage your team" settings surface (members, roles, team groupings).
 */

export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';

export interface RoleDef {
  key: MemberRole;
  label: string;
  /** Pill tint (background) + text colour for the role chip. */
  bg: string;
  fg: string;
}

export const ROLE_DEFS: Record<MemberRole, RoleDef> = {
  owner: { key: 'owner', label: 'Owner', bg: 'rgba(46,182,125,0.16)', fg: 'rgb(33,140,94)' },
  admin: { key: 'admin', label: 'Admin', bg: 'rgba(255,138,76,0.16)', fg: 'rgb(196,93,32)' },
  member: { key: 'member', label: 'Member', bg: 'rgba(80,80,80,0.10)', fg: 'rgb(70,70,70)' },
  guest: { key: 'guest', label: 'Guest', bg: 'rgba(80,80,80,0.06)', fg: 'rgb(120,120,120)' },
};

/** Role options offered in the editable row dropdown, in display order. */
export const ROLE_ORDER: MemberRole[] = ['owner', 'admin', 'member', 'guest'];

export interface TeamSeed {
  id: string;
  name: string;
  /** Member ids belonging to this team. */
  memberIds: string[];
  /** Avatar tile tint for the team card. */
  color: string;
}

export interface MemberSeed {
  id: string;
  name: string;
  initials: string;
  color: string;
  email: string;
  role: MemberRole;
  teamIds: string[];
  /** Human-readable relative last-active label. */
  lastActive: string;
  /** Online presence dot. */
  online: boolean;
}

export const TEAM_SEED: TeamSeed[] = [
  { id: 'tm-eng', name: 'Engineering', memberIds: ['m1', 'm2', 'm5', 'm9'], color: 'rgb(72,118,236)' },
  { id: 'tm-design', name: 'Design', memberIds: ['m3', 'm7', 'm11'], color: 'rgb(232,93,117)' },
  { id: 'tm-product', name: 'Product', memberIds: ['m1', 'm4', 'm8'], color: 'rgb(46,182,125)' },
  { id: 'tm-marketing', name: 'Marketing', memberIds: ['m6', 'm10'], color: 'rgb(255,159,67)' },
  { id: 'tm-ops', name: 'Operations', memberIds: ['m2', 'm12'], color: 'rgb(153,102,204)' },
];

export const MEMBER_SEED: MemberSeed[] = [
  { id: 'm1', name: 'Cameron Mc', initials: 'CM', color: 'rgb(89,93,102)', email: 'cameron12mcallister@gmail.com', role: 'owner', teamIds: ['tm-eng', 'tm-product'], lastActive: 'Active now', online: true },
  { id: 'm2', name: 'Priya Raman', initials: 'PR', color: 'rgb(72,118,236)', email: 'priya.raman@acme.co', role: 'admin', teamIds: ['tm-eng', 'tm-ops'], lastActive: '12 minutes ago', online: true },
  { id: 'm3', name: 'Diego Santos', initials: 'DS', color: 'rgb(232,93,117)', email: 'diego.santos@acme.co', role: 'admin', teamIds: ['tm-design'], lastActive: '3 hours ago', online: false },
  { id: 'm4', name: 'Hana Kim', initials: 'HK', color: 'rgb(46,182,125)', email: 'hana.kim@acme.co', role: 'member', teamIds: ['tm-product'], lastActive: 'Yesterday', online: false },
  { id: 'm5', name: 'Liam O’Brien', initials: 'LO', color: 'rgb(255,159,67)', email: 'liam.obrien@acme.co', role: 'member', teamIds: ['tm-eng'], lastActive: '2 days ago', online: false },
  { id: 'm6', name: 'Aisha Bello', initials: 'AB', color: 'rgb(153,102,204)', email: 'aisha.bello@acme.co', role: 'member', teamIds: ['tm-marketing'], lastActive: '5 hours ago', online: true },
  { id: 'm7', name: 'Noah Weber', initials: 'NW', color: 'rgb(38,166,154)', email: 'noah.weber@acme.co', role: 'member', teamIds: ['tm-design'], lastActive: '1 hour ago', online: true },
  { id: 'm8', name: 'Sofia Rossi', initials: 'SR', color: 'rgb(244,143,177)', email: 'sofia.rossi@acme.co', role: 'member', teamIds: ['tm-product'], lastActive: '4 days ago', online: false },
  { id: 'm9', name: 'Marcus Lee', initials: 'ML', color: 'rgb(120,144,156)', email: 'marcus.lee@acme.co', role: 'member', teamIds: ['tm-eng'], lastActive: '30 minutes ago', online: true },
  { id: 'm10', name: 'Emma Fischer', initials: 'EF', color: 'rgb(255,112,67)', email: 'emma.fischer@acme.co', role: 'member', teamIds: ['tm-marketing'], lastActive: 'Yesterday', online: false },
  { id: 'm11', name: 'Tariq Aziz', initials: 'TA', color: 'rgb(92,107,192)', email: 'tariq.aziz@contractor.io', role: 'guest', teamIds: ['tm-design'], lastActive: '1 week ago', online: false },
  { id: 'm12', name: 'Grace Park', initials: 'GP', color: 'rgb(38,198,218)', email: 'grace.park@acme.co', role: 'guest', teamIds: ['tm-ops'], lastActive: '3 weeks ago', online: false },
];

const MEMBER_BY_ID = new Map(MEMBER_SEED.map((m) => [m.id, m]));

export function getMember(id: string): MemberSeed | undefined {
  return MEMBER_BY_ID.get(id);
}

export function teamMembers(team: TeamSeed): MemberSeed[] {
  return team.memberIds.map((id) => MEMBER_BY_ID.get(id)).filter((m): m is MemberSeed => Boolean(m));
}

const TEAM_BY_ID = new Map(TEAM_SEED.map((t) => [t.id, t]));

export function teamName(id: string): string {
  return TEAM_BY_ID.get(id)?.name ?? id;
}

/** Count of non-guest members (used for the "People" headline counts). */
export const PEOPLE_COUNT = MEMBER_SEED.filter((m) => m.role !== 'guest').length;
export const GUEST_COUNT = MEMBER_SEED.filter((m) => m.role === 'guest').length;
export const TEAM_COUNT = TEAM_SEED.length;
