import type { RouteSpec } from './types.js';

export const ROUTES: RouteSpec[] = [
  {
    id: 'home',
    path: '/90152566819/home',
    settleMs: 3000,
    pixelThreshold: 0.95,
    domThreshold: 0.90,
  },
  {
    id: 'notifications',
    path: '/90152566819/notifications',
    settleMs: 2000,
    pixelThreshold: 0.95,
    domThreshold: 0.90,
  },
  {
    id: 'inbox',
    path: '/90152566819/inbox',
    settleMs: 2000,
    pixelThreshold: 0.95,
    domThreshold: 0.90,
  },
  {
    id: 'settings-account',
    path: '/90152566819/settings/account',
    settleMs: 2000,
    pixelThreshold: 0.93,
    domThreshold: 0.88,
  },
  {
    id: 'list-view',
    path: '/90152566819/v/l/2kyr6013-1115',
    settleMs: 5000,
    pixelThreshold: 0.85,
    domThreshold: 0.80,
  },
  {
    id: 'doc-view',
    path: '/90152566819/v/dc/2kyr6013-1595/2kyr6013-375',
    settleMs: 4000,
    pixelThreshold: 0.85,
    domThreshold: 0.80,
  },
];
