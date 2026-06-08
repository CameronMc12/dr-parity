/**
 * Built-in starter task templates. These ship with the app, are merged ahead of
 * any user-created templates on hydrate, and cannot be deleted (`builtin: true`).
 */

import type { TaskTemplate } from './types';

export const SEED_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-bug-report',
    name: 'Bug Report',
    status: 'to do',
    priority: 'high',
    description: 'Steps to reproduce, expected vs actual behaviour, and environment details.',
    tags: ['bug'],
    checklist: [
      'Steps to reproduce',
      'Expected result',
      'Actual result',
      'Environment / browser',
      'Screenshots or logs attached',
    ],
    builtin: true,
  },
  {
    id: 'tpl-feature-request',
    name: 'Feature Request',
    status: 'to do',
    priority: 'normal',
    description: 'Describe the problem this feature solves and the proposed solution.',
    tags: ['feature'],
    checklist: [
      'Problem statement',
      'Proposed solution',
      'Success criteria',
      'Out of scope',
    ],
    builtin: true,
  },
  {
    id: 'tpl-sprint-task',
    name: 'Sprint Task',
    status: 'to do',
    priority: 'normal',
    description: 'Scoped unit of work for the current sprint with a clear definition of done.',
    tags: ['sprint'],
    checklist: [
      'Acceptance criteria',
      'Implementation notes',
      'Tests written',
      'Definition of done met',
    ],
    builtin: true,
  },
  {
    id: 'tpl-meeting-notes',
    name: 'Meeting Notes',
    status: 'in progress',
    priority: null,
    description: 'Agenda, decisions, and action items captured during the meeting.',
    tags: ['meeting'],
    checklist: ['Attendees', 'Agenda', 'Decisions', 'Action items', 'Follow-ups'],
    builtin: true,
  },
  {
    id: 'tpl-onboarding',
    name: 'Onboarding',
    status: 'to do',
    priority: 'normal',
    description: 'Checklist for ramping a new team member onto the project.',
    tags: ['onboarding'],
    checklist: [
      'Grant tool access',
      'Intro to team',
      'Read project docs',
      'First task assigned',
      'Setup local environment',
    ],
    builtin: true,
  },
];
