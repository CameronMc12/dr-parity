/**
 * The DR-PARITY-SEED fixture — one declarative description of every ClickUp
 * entity the crawler needs to reach a fully-populated UI in every view type
 * (List / Board / Calendar / Gantt / Table / Timeline / Doc).
 *
 * Coverage goals encoded below:
 *   - all priorities: urgent / high / normal / low / none
 *   - multiple statuses incl. a custom status set on the second folder's lists
 *   - tasks with + without a self-assignee
 *   - due dates spread past / today / future (calendar + gantt fill in)
 *   - start + due ranges (gantt + timeline bars)
 *   - subtasks, checklists, tags, dependencies (gantt links)
 *   - custom field VALUES across text / number / dropdown / date / checkbox
 *   - comment threads
 *   - long titles for truncation + tooltip hover states
 *   - a multi-page rich Doc
 */

import { SEED_MARKER, type SeedFixture } from './types.js';

const LONG_TITLE =
  'This is a deliberately very long task title used to exercise truncation, ' +
  'ellipsis, and tooltip-on-hover states across the list, board, table, and ' +
  'gantt views of the cloned ClickUp interface';

export const fixture: SeedFixture = {
  space: {
    key: 'space',
    name: `${SEED_MARKER} Space`,
    tags: [
      { name: 'seed-frontend', fg: '#ffffff', bg: '#7b68ee' },
      { name: 'seed-backend', fg: '#ffffff', bg: '#02bcd4' },
      { name: 'seed-urgent', fg: '#ffffff', bg: '#e44258' },
      { name: 'seed-research', fg: '#1f1f1f', bg: '#fddc5c' },
    ],
    folders: [
      {
        key: 'folder.product',
        name: `${SEED_MARKER} Product`,
        lists: [
          {
            key: 'list.product.backlog',
            name: 'Backlog',
            content: 'Seed backlog list covering every priority + status.',
            tasks: [
              {
                key: 'task.urgent',
                name: 'Urgent: ship the parity gate fix',
                description: 'Highest priority seed task. Assigned to self.',
                status: 'to do',
                priority: 'urgent',
                assignSelf: true,
                startAnchor: { offsetDays: -2 },
                dueAnchor: { offsetDays: 1 },
                tags: ['seed-urgent', 'seed-frontend'],
                comments: [
                  { text: 'Seed comment: kicking this off.' },
                  { text: 'Seed comment: blocked on the dependency below.' },
                ],
                checklists: [
                  {
                    name: 'Pre-flight',
                    items: [
                      { name: 'Reproduce the diff', resolved: true },
                      { name: 'Write the fix', resolved: false },
                      { name: 'Add a regression case', resolved: false },
                    ],
                  },
                ],
                customFields: [
                  { name: 'Story Points', type: 'number', value: 8 },
                  { name: 'Environment', type: 'drop_down', dropdownOptionName: 'Production' },
                  { name: 'Reviewed', type: 'checkbox', value: true },
                ],
              },
              {
                key: 'task.high',
                name: 'High: refactor the crawler discovery merge',
                status: 'in progress',
                priority: 'high',
                assignSelf: true,
                startAnchor: { offsetDays: 0 },
                dueAnchor: { offsetDays: 5 },
                tags: ['seed-backend'],
                dependsOnKey: 'task.urgent',
                subtasks: [
                  { key: 'task.high.sub1', name: 'Audit current merge', status: 'complete', priority: 'normal' },
                  { key: 'task.high.sub2', name: 'Design new merge', priority: 'high', dueAnchor: { offsetDays: 3 } },
                ],
                customFields: [
                  { name: 'Story Points', type: 'number', value: 5 },
                  { name: 'Owner Notes', type: 'text', value: 'Needs design review' },
                ],
              },
              {
                key: 'task.normal',
                name: 'Normal: document the seed pipeline',
                status: 'to do',
                priority: 'normal',
                assignSelf: false,
                dueAnchor: { offsetDays: 12 },
                tags: ['seed-research'],
                customFields: [
                  { name: 'Environment', type: 'drop_down', dropdownOptionName: 'Staging' },
                ],
              },
              {
                key: 'task.low',
                name: 'Low: tidy up old QA helpers',
                status: 'to do',
                priority: 'low',
                assignSelf: false,
                dueAnchor: { offsetDays: 30 },
              },
              {
                key: 'task.none',
                name: 'No priority: someday investigate timeline view',
                status: 'to do',
                priority: null,
                assignSelf: false,
                dueAnchor: null,
              },
              {
                key: 'task.longtitle',
                name: LONG_TITLE,
                status: 'in progress',
                priority: 'normal',
                assignSelf: true,
                startAnchor: { offsetDays: -5 },
                dueAnchor: { offsetDays: 8 },
                tags: ['seed-frontend', 'seed-backend', 'seed-research'],
              },
            ],
          },
          {
            key: 'list.product.done',
            name: 'Shipped',
            content: 'Completed work — populates the Complete column on boards.',
            tasks: [
              {
                key: 'task.done.1',
                name: 'Complete: initial capture pipeline',
                status: 'complete',
                priority: 'normal',
                assignSelf: true,
                startAnchor: { offsetDays: -20 },
                dueAnchor: { offsetDays: -10 },
                customFields: [{ name: 'Reviewed', type: 'checkbox', value: true }],
              },
              {
                key: 'task.done.2',
                name: 'Complete: parse:har support',
                status: 'complete',
                priority: 'high',
                assignSelf: false,
                startAnchor: { offsetDays: -15 },
                dueAnchor: { offsetDays: -6 },
              },
            ],
          },
        ],
      },
      {
        key: 'folder.ops',
        name: `${SEED_MARKER} Operations`,
        lists: [
          {
            key: 'list.ops.pipeline',
            name: 'Pipeline',
            content: 'List using a CUSTOM status set (review / blocked stages).',
            tasks: [
              {
                key: 'task.ops.review',
                name: 'Custom status: in code review',
                status: 'review',
                priority: 'high',
                assignSelf: true,
                startAnchor: { offsetDays: -1 },
                dueAnchor: { offsetDays: 2 },
                tags: ['seed-backend'],
              },
              {
                key: 'task.ops.blocked',
                name: 'Custom status: blocked on infra',
                status: 'blocked',
                priority: 'urgent',
                assignSelf: true,
                dueAnchor: { offsetDays: 0 },
                tags: ['seed-urgent'],
                comments: [{ text: 'Seed comment: waiting on the platform team.' }],
                dependsOnKey: 'task.ops.review',
              },
              {
                key: 'task.ops.staging',
                name: 'Custom status: deployed to staging',
                status: 'staging',
                priority: 'normal',
                assignSelf: false,
                dueAnchor: { offsetDays: 4 },
              },
            ],
          },
        ],
      },
    ],
    folderlessLists: [
      {
        key: 'list.inbox',
        name: 'Inbox (folderless)',
        content: 'A folderless list living directly under the space.',
        tasks: [
          {
            key: 'task.inbox.1',
            name: 'Folderless: triage incoming requests',
            status: 'to do',
            priority: 'high',
            assignSelf: true,
            dueAnchor: { offsetDays: 1 },
            tags: ['seed-research'],
            checklists: [
              {
                name: 'Triage steps',
                items: [
                  { name: 'Label', resolved: false },
                  { name: 'Assign', resolved: false },
                ],
              },
            ],
          },
          {
            key: 'task.inbox.2',
            name: 'Folderless: archive stale items',
            status: 'to do',
            priority: 'low',
            assignSelf: false,
            dueAnchor: { offsetDays: 20 },
          },
        ],
      },
    ],
    docs: [
      {
        key: 'doc.handbook',
        name: `${SEED_MARKER} Handbook`,
        pages: [
          {
            key: 'doc.handbook.overview',
            name: 'Overview',
            content:
              '# Seed Handbook\n\nThis doc exists so the Doc view renders real ' +
              'rich content during capture.\n\n- Bullet one\n- Bullet two\n\n' +
              '**Bold text** and *italic text* for formatting coverage.',
          },
          {
            key: 'doc.handbook.process',
            name: 'Process',
            content:
              '## Process\n\n1. Capture\n2. Parse\n3. Clone\n4. Build\n5. Verify\n\n' +
              '> A blockquote for the renderer.\n\n```ts\nconst x = 1;\n```',
          },
          {
            key: 'doc.handbook.faq',
            name: 'FAQ',
            content:
              '### FAQ\n\n**Q:** Why seed?\n\n**A:** To make every view populate ' +
              'deterministically.\n\n| Col A | Col B |\n| --- | --- |\n| 1 | 2 |',
          },
        ],
      },
    ],
    goals: [
      {
        key: 'goal.parity',
        name: `${SEED_MARKER} Reach 99% parity`,
        description: 'Seed goal so the Goals surface is non-empty.',
        dueAnchor: { offsetDays: 45 },
      },
    ],
  },
};
