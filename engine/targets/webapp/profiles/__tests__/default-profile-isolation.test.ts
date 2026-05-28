/**
 * Default-profile isolation test.
 *
 * The repo currently has no test runner wired into `package.json`, so this
 * file is structured as a standalone `tsx`-executable assertion script. Run
 * with:
 *
 *     npx tsx engine/targets/webapp/profiles/__tests__/default-profile-isolation.test.ts
 *
 * Assertions:
 *   1. resolveProfile('linear.app')      => 'default'
 *   2. resolveProfile('notion.so')       => 'default'
 *   3. defaultProfile.discoverers        is []
 *   4. resolveProfile('app.clickup.com') => 'clickup'
 *
 * The script exits with code 0 on success and code 1 on any failed assertion.
 */

import { defaultProfile, resolveProfile } from '../index';

type Check = { name: string; pass: boolean; detail: string };

function check(name: string, pass: boolean, detail: string): Check {
  return { name, pass, detail };
}

function run(): Check[] {
  const checks: Check[] = [];

  const linear = resolveProfile('linear.app');
  checks.push(
    check(
      "resolveProfile('linear.app') returns default",
      linear.name === 'default',
      `got name="${linear.name}"`,
    ),
  );

  const notion = resolveProfile('notion.so');
  checks.push(
    check(
      "resolveProfile('notion.so') returns default",
      notion.name === 'default',
      `got name="${notion.name}"`,
    ),
  );

  const ds = defaultProfile.discoverers;
  checks.push(
    check(
      'default.discoverers is []',
      Array.isArray(ds) && ds.length === 0,
      `got length=${ds ? ds.length : 'undefined'}`,
    ),
  );

  const clickup = resolveProfile('app.clickup.com');
  checks.push(
    check(
      "resolveProfile('app.clickup.com') returns clickup",
      clickup.name === 'clickup',
      `got name="${clickup.name}"`,
    ),
  );

  return checks;
}

const results = run();
let failures = 0;
for (const r of results) {
  const flag = r.pass ? 'PASS' : 'FAIL';
  console.log(`[default-profile-isolation] ${flag}  ${r.name} — ${r.detail}`);
  if (!r.pass) failures++;
}
if (failures > 0) {
  console.log(`[default-profile-isolation] ${failures} check(s) failed`);
  process.exit(1);
}
console.log('[default-profile-isolation] all checks passed');
