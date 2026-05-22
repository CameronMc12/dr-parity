/**
 * Phase 4 emit-mocks types. RequestRecord is the normalized shape we
 * extract from the crawler's network.jsonl (request/response pair) and
 * from the form-capture pipeline's forms.jsonl.
 */

export type RequestRecord = {
  method: string;
  url: string;
  requestBody?: string | null;
  responseStatus: number;
  responseBody?: string | null;
  responseHeaders: Record<string, string>;
  capturedAt: string;
};

export type EndpointGroup = {
  method: string;
  pathPattern: string;
  origin: string;
  records: RequestRecord[];
};

export type FixtureFile = {
  relativePath: string;
  content: string;
};

export type GeneratedHandler = {
  endpoint: EndpointGroup;
  fixtureFiles: string[];
  handlerCode: string;
};

export type EmitMocksResult = {
  handlersTs: string;
  fixtures: FixtureFile[];
  warnings: string[];
  endpointCount: number;
  fixtureCount: number;
};
