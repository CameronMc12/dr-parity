import { loadConfig, fetchJson, v2, throttle } from "./lib/clickup-client";

interface View {
  id: string;
  name: string;
  type: string;
}

interface ViewResponse {
  views: View[];
  required_views?: Record<string, View>;
}

const CANDIDATES = [
  { kind: "list", id: "901523543285", label: "Weekly Execution (Roadmap & Backlog folder)" },
  { kind: "list", id: "901523543273", label: "Product Roadmap (Roadmap & Backlog folder)" },
  { kind: "list", id: "901523547043", label: "AB Content Management (Sprint Team folder)" },
  { kind: "folder", id: "901516144641", label: "Roadmap & Backlog folder" },
  { kind: "folder", id: "901516144663", label: "Sprint Team folder" },
  { kind: "space", id: "901511060890", label: "Software Development space" },
];

function pathFor(kind: string, id: string): string {
  if (kind === "list") return `/list/${id}/view`;
  if (kind === "folder") return `/folder/${id}/view`;
  if (kind === "space") return `/space/${id}/view`;
  throw new Error(`unknown kind ${kind}`);
}

async function main(): Promise<void> {
  const { token } = loadConfig();

  for (const c of CANDIDATES) {
    const url = v2(pathFor(c.kind, c.id));
    const res = await fetchJson<ViewResponse>(url, token);
    console.log(`\n=== ${c.kind.toUpperCase()} ${c.id} — ${c.label} ===`);
    if (!res.ok) {
      console.log(`  ERROR ${res.status}: ${res.body}`);
      await throttle();
      continue;
    }

    const own = res.data.views ?? [];
    const required = res.data.required_views ?? {};
    const reqList = Object.entries(required)
      .filter(([, v]) => v && (v as View).id)
      .map(([slot, v]) => ({ slot, ...(v as View) }));

    const byType = new Map<string, number>();
    for (const v of own) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
    for (const v of reqList) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);

    console.log(`  view types present: ${[...byType.keys()].sort().join(", ") || "(none)"}`);
    console.log(`  own views (${own.length}):`);
    for (const v of own) console.log(`    [${v.type}] ${v.id}  ${v.name}`);
    if (reqList.length) {
      console.log(`  required_views:`);
      for (const v of reqList) console.log(`    (${v.slot}) [${v.type}] ${v.id}  ${v.name}`);
    }
    await throttle();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
