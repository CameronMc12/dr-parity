/**
 * Backend barrel. The OWNED local server that serves ClickUp's internal-shape
 * reads from the user's real export data, so the replayed Angular bundle works
 * as a live app offline. Phase A: dynamic reads. Phase B (later): persistence.
 */

export { JsonStore } from './json-store';
export { EventBackedStore, type EventBackedStoreOptions } from './event-store-backed';
export { seedSnapshot } from './seed';
export {
  buildCommandBus,
  seedEventStore,
  type SeedEventStoreResult,
  type Command,
  type CommandType,
} from './cqrs/index';
export { loadTemplates, getCachedTemplates } from './templates-cache';
export { routeRequest, type RoutedResponse } from './router';
export { CoverageLog, templatizePath, type CoverageEntry, type CoverageOutcome } from './coverage';
export { HANDLERS, type RequestCtx, type Handler } from './handlers';
export type { BackendStore, StoreSnapshot, StoreMember, StoreCustomFieldSet } from './store-types';
