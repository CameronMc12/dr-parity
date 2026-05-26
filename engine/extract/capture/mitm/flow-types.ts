/**
 * Typed transport-capture flow shapes for the mitmproxy layer.
 *
 * One {@link Flow} = one HTTP request/response pair OR one standalone websocket
 * envelope (a flow whose `kind` is `'websocket'` carries its frames in
 * `wsMessages`). The mitm addon writes each of these as a single NDJSON line;
 * {@link FlowReader} parses them back into these types.
 *
 * Bodies are referenced indirectly (`BodyRef`) so a large response body can be
 * carried inline as text, inline as base64 (binary), or — for very large bodies
 * — stored out-of-line and pointed at by path. This keeps the NDJSON stream
 * streamable line-by-line without loading every body into memory at once.
 */

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'CONNECT'
  | 'TRACE';

/**
 * How a body is carried. Discriminated so a reader never guesses an encoding.
 *  - 'text'   : UTF-8 text carried inline in `text`.
 *  - 'base64' : binary carried inline, base64-encoded in `base64`.
 *  - 'path'   : body persisted out-of-line; `path` points at the file.
 *  - 'empty'  : no body (or intentionally dropped).
 */
export type BodyRef =
  | { encoding: 'text'; text: string; size: number; contentType?: string }
  | { encoding: 'base64'; base64: string; size: number; contentType?: string }
  | { encoding: 'path'; path: string; size: number; contentType?: string }
  | { encoding: 'empty'; size: 0; contentType?: string };

/** Header bag. Lower-cased keys recommended but not enforced by the reader. */
export type HeaderMap = Record<string, string>;

/** One websocket frame within a flow. */
export type WsMessage = {
  /** From the client to the server, or from the server to the client. */
  direction: 'sent' | 'received';
  /** Whether the frame payload is text or binary. */
  type: 'text' | 'binary';
  /** Inline payload. Base64 when `type` is 'binary'. */
  payload: string;
  /** mitm-relative timestamp (epoch seconds, float) for this frame. */
  t: number;
};

/** mitm-derived timing for a flow. All values epoch seconds (float). */
export type FlowTiming = {
  /** When the client started the request. */
  requestStart?: number;
  /** When the response was first seen. */
  responseStart?: number;
  /** When the flow finished. */
  responseEnd?: number;
};

/**
 * The canonical transport flow. `kind` discriminates an HTTP exchange from a
 * websocket envelope so consumers branch without sniffing fields.
 */
export type Flow = {
  /** Stable per-flow id assigned by the addon (mitm flow id). */
  id: string;
  /** 'http' for request/response pairs, 'websocket' for ws envelopes. */
  kind: 'http' | 'websocket';
  method: HttpMethod | string;
  url: string;
  reqHeaders: HeaderMap;
  reqBody: BodyRef;
  /** Absent on a websocket envelope or a request that never got a response. */
  status?: number;
  respHeaders: HeaderMap;
  /** Absent on a websocket envelope. */
  respBody?: BodyRef;
  timing: FlowTiming;
  /** Populated only on websocket flows. Empty for plain HTTP. */
  wsMessages: WsMessage[];
  /** Client source port — disambiguates concurrent connections. */
  clientPort?: number;
  /** Flow wall-clock timestamp (epoch seconds, float) — used by correlation. */
  t: number;
};

/** Type guard: is this flow a websocket envelope. */
export function isWebsocketFlow(flow: Flow): boolean {
  return flow.kind === 'websocket';
}

/** Type guard: is this flow a mutating HTTP request (write side of CQRS). */
export function isMutatingFlow(flow: Flow): boolean {
  if (flow.kind !== 'http') return false;
  const m = flow.method.toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}
