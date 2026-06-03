import { Button } from '@/components/ui/Button';

const INTEGRATIONS = [
  { name: 'GitHub',      description: 'Link pull requests and commits to tasks.', connected: false },
  { name: 'Slack',       description: 'Get ClickUp notifications in Slack.',        connected: false },
  { name: 'Google Drive','description': 'Attach Google Drive files to tasks.',      connected: false },
  { name: 'Figma',       description: 'Embed Figma designs in tasks.',              connected: false },
  { name: 'Zapier',      description: 'Automate workflows with 5000+ apps.',        connected: false },
];

export function Integrations() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Integrations
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Connect ClickUp to your other tools.
      </p>

      <div className="flex flex-col gap-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="
              flex items-center gap-4 px-4 py-3 rounded-[var(--cu-radius-lg)]
              bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
            "
          >
            <div
              className="
                w-9 h-9 rounded-[var(--cu-radius-md)] flex items-center justify-center
                bg-[var(--cu-bg-hover)] text-[var(--cu-text-muted)] text-lg shrink-0
              "
            >
              {integration.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--cu-text-primary)] font-medium">
                {integration.name}
              </p>
              <p className="text-xs text-[var(--cu-text-muted)]">
                {integration.description}
              </p>
            </div>
            <Button variant="secondary" size="sm">
              Connect
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
