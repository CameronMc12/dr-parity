import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

const MOCK_MEMBERS = [
  { name: 'Cameron M',    email: 'cameron12mcallister@gmail.com', role: 'Owner' },
  { name: 'Alice K',      email: 'alice@example.com',             role: 'Admin' },
  { name: 'Bob T',        email: 'bob@example.com',               role: 'Member' },
  { name: 'Charlie R',    email: 'charlie@example.com',           role: 'Member' },
];

export function Members() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
            People
          </h1>
          <p className="text-[var(--cu-text-muted)] text-xs">
            {MOCK_MEMBERS.length} members in this workspace.
          </p>
        </div>
        <Button variant="primary" size="sm">
          Invite members
        </Button>
      </div>

      <div
        className="
          rounded-[var(--cu-radius-lg)] overflow-hidden
          bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
        "
      >
        {MOCK_MEMBERS.map((member, i) => (
          <div
            key={member.email}
            className={`
              flex items-center gap-3 px-4 py-3
              ${i < MOCK_MEMBERS.length - 1 ? 'border-b border-[var(--cu-border-divider)]' : ''}
            `}
          >
            <Avatar fallback={member.name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--cu-text-primary)] font-medium truncate">
                {member.name}
              </p>
              <p className="text-xs text-[var(--cu-text-muted)] truncate">
                {member.email}
              </p>
            </div>
            <span
              className="
                text-xs px-2 py-0.5 rounded-[var(--cu-radius-sm)]
                bg-[var(--cu-bg-hover)] text-[var(--cu-text-secondary)]
              "
            >
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
