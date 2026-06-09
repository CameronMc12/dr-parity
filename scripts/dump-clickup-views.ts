import { loadConfig, fetchJson, v2, throttle } from "./lib/clickup-client";

interface RawView {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface ViewResponse {
  views?: RawView[];
  required_views?: Record<string, RawView>;
}

const CANDIDATES = [
  { kind: "list", id: "901523547043", label: "AB Content Management" },
  { kind: "list", id: "901523543285", label: "Weekly Execution" },
  { kind: "list", id: "901523543273", label: "Product Roadmap" },
  { kind: "space", id: "901511060890", label: "Software Development space" },
  { kind: "team", id: "90152566819", label: "Workspace (team-level)" },
];

function pathFor(kind: string, id: string): string {
  if (kind === "list") return `/list/${id}/view`;
  if (kind === "folder") return `/folder/${id}/view`;
  if (kind === "space") return `/space/${id}/view`;
  if (kind === "team") return `/team/${id}/view`;
  throw new Error(`unknown kind ${kind}`);
}

// App URL slug per view type. Unknown types print "??".
const SLUG_BY_TYPE: Record<string, string> = {
  list: "l",
  board: "b",
  table: "t",
  timeline: "li",
  gantt: "gc",
  calendar: "cal",
  doc: "dc",
  map: "map",
  workload: "wl",
  activity: "act",
  mindmap: "mm",
  form: "f",
  embed: "em",
  chat: "ch",
  conversation: "ch",
};

function appUrl(teamId: string, type: string, id: string): string {
  const slug = SLUG_BY_TYPE[type] ?? "??";
  return `https://app.clickup.com/${teamId}/v/${slug}/${id}`;
}

function summarizeView(teamId: string, v: RawView, slot?: string): void {
  const slotTag = slot ? `(${slot}) ` : "";
  console.log(`\n  ${slotTag}[type=${v.type}] id=${v.id}  name=${JSON.stringify(v.name)}`);
  console.log(`    candidate app URL: ${appUrl(teamId, v.type, v.id)}`);
  // Print every top-level field so we can see url/slug/protected/parent etc.
  const keys = Object.keys(v).sort();
  for (const k of keys) {
    if (k === "id" || k === "name" || k === "type") continue;
    const val = v[k];
    const rendered =
      typeof val === "object" && val !== null
        ? JSON.stringify(val)
        : String(val);
    const clipped = rendered.length > 200 ? `${rendered.slice(0, 200)}…` : rendered;
    console.log(`      ${k}: ${clipped}`);
  }
}

async function main(): Promise<void> {
  const { token, teamId } = loadConfig();
  const found: Array<{ where: string; type: string; id: string; name: string }> = [];

  for (const c of CANDIDATES) {
    const url = v2(pathFor(c.kind, c.id));
    const res = await fetchJson<ViewResponse>(url, token);
    console.log(`\n================ ${c.kind.toUpperCase()} ${c.id} — ${c.label} ================`);
    if (!res.ok) {
      console.log(`  ERROR ${res.status}: ${res.body}`);
      await throttle();
      continue;
    }

    const own = res.data.views ?? [];
    const required = res.data.required_views ?? {};

    console.log(`  own views: ${own.length}`);
    for (const v of own) {
      summarizeView(teamId, v);
      found.push({ where: c.label, type: v.type, id: v.id, name: v.name });
    }

    const reqEntries = Object.entries(required).filter(([, v]) => v && (v as RawView).id);
    if (reqEntries.length) {
      console.log(`\n  required_views: ${reqEntries.length}`);
      for (const [slot, v] of reqEntries) {
        summarizeView(teamId, v as RawView, slot);
        found.push({ where: `${c.label}:required:${slot}`, type: (v as RawView).type, id: (v as RawView).id, name: (v as RawView).name });
      }
    }
    await throttle();
  }

  console.log(`\n\n================ CALENDAR / GANTT / TIMELINE SUMMARY ================`);
  const targets = found.filter((f) => /calendar|gantt|timeline/i.test(f.type));
  if (targets.length === 0) {
    console.log("  No calendar/gantt/timeline views found on any queried list/space/team.");
  } else {
    for (const t of targets) {
      console.log(`  [${t.type}] ${t.id}  ${JSON.stringify(t.name)}  @ ${t.where}`);
      console.log(`      -> ${appUrl(teamId, t.type, t.id)}`);
    }
  }

  console.log(`\n  All distinct view types seen: ${[...new Set(found.map((f) => f.type))].sort().join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
