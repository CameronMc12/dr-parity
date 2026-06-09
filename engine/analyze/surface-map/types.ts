/**
 * Shared types for the Phase 1 Static Surface Map extractor.
 */

export type NetworkRequestLine = {
  kind: 'request';
  capturedAt?: string;
  method: string;
  url: string;
  resourceType?: string;
  headers?: Record<string, string>;
  postData?: string | null;
};

export type NetworkResponseLine = {
  kind: 'response';
  capturedAt?: string;
  status?: string | number;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
  bodyEncoding?: 'utf8' | 'base64' | string;
  bodySize?: string | number;
};

export type ShapeValue = string | ShapeObject | ShapeValue[];
export type ShapeObject = { [key: string]: ShapeValue };

export type EndpointEntry = {
  service: string;
  version: string;
  method: string;
  pathTemplate: string;
  exampleUrl: string;
  count: number;
  sampleRequestBodyShape: ShapeValue | null;
  sampleResponseBodyShape: ShapeValue | null;
};

export type EndpointsByService = Record<string, EndpointEntry[]>;

export type RouteNode = {
  path: string;
  source: string;
  loadChildren?: string;
  redirectTo?: string;
  component?: string;
  children?: RouteNode[];
};

export type ObservedRoute = {
  pattern: string;
  examples: string[];
  count: number;
};

export type RoutesResult = {
  routeDefinitions: RouteNode[];
  observedRoutes: ObservedRoute[];
};

export type ActionGroup = {
  namespace: string;
  count: number;
  actions: string[];
};

export type WakaruResult = {
  chunk: string;
  reason: string;
  status: 'unpacked' | 'failed' | 'skipped';
  note?: string;
};
