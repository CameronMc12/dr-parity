"""Dr Parity mitmproxy addon: NDJSON transport capture.

Writes one NDJSON line per HTTP flow and per websocket message to the file at
$DRPARITY_MITM_OUT. Each line is a self-contained JSON object matching the
TypeScript `Flow` / `WsMessage` shapes in flow-types.ts.

Run:  mitmdump -s mitm_addon.py --listen-port <port>
Env:  DRPARITY_MITM_OUT=/abs/path/to/flows.ndjson   (required)

Bodies are emitted inline as utf-8 text when decodable, else base64. A flow's
NDJSON record carries `kind: "http"`; each websocket frame is its own line with
`kind: "ws"` keyed by the parent flow id.
"""

import base64
import json
import os
import threading
import time
from typing import Any

from mitmproxy import ctx, http


def _now() -> float:
    return time.time()


def _encode_body(raw: bytes | None, content_type: str | None) -> dict[str, Any]:
    if not raw:
        return {"encoding": "empty", "size": 0, "contentType": content_type}
    try:
        text = raw.decode("utf-8")
        return {"encoding": "text", "text": text, "size": len(raw), "contentType": content_type}
    except UnicodeDecodeError:
        return {"encoding": "base64", "base64": base64.b64encode(raw).decode("ascii"), "size": len(raw), "contentType": content_type}


class DrParityCapture:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        out = os.environ.get("DRPARITY_MITM_OUT")
        if not out:
            raise RuntimeError("DRPARITY_MITM_OUT env var is required (NDJSON output path)")
        self._path = out
        self._fh = open(out, "a", encoding="utf-8")
        ctx.log.info(f"[drparity] writing flows to {out}")

    def _write(self, record: dict[str, Any]) -> None:
        line = json.dumps(record, separators=(",", ":"), ensure_ascii=False)
        with self._lock:
            self._fh.write(line + "\n")
            self._fh.flush()

    def response(self, flow: http.HTTPFlow) -> None:
        req, res = flow.request, flow.response
        self._write({
            "id": flow.id,
            "kind": "http",
            "method": req.method,
            "url": req.pretty_url,
            "reqHeaders": dict(req.headers),
            "reqBody": _encode_body(req.raw_content, req.headers.get("content-type")),
            "status": res.status_code if res else None,
            "respHeaders": dict(res.headers) if res else {},
            "respBody": _encode_body(res.raw_content, res.headers.get("content-type")) if res else None,
            "timing": {
                "requestStart": req.timestamp_start,
                "responseStart": res.timestamp_start if res else None,
                "responseEnd": res.timestamp_end if res else None,
            },
            "clientPort": flow.client_conn.peername[1] if flow.client_conn and flow.client_conn.peername else None,
            "t": _now(),
        })

    def websocket_message(self, flow: http.HTTPFlow) -> None:
        ws = flow.websocket
        if ws is None or not ws.messages:
            return
        msg = ws.messages[-1]
        self._write({
            "id": flow.id,
            "kind": "ws",
            "url": flow.request.pretty_url,
            "direction": "sent" if msg.from_client else "received",
            "type": "text" if msg.is_text else "binary",
            "payload": msg.content.decode("utf-8", "replace") if msg.is_text else base64.b64encode(msg.content).decode("ascii"),
            "t": msg.timestamp,
        })

    def done(self) -> None:
        with self._lock:
            self._fh.close()


addons = [DrParityCapture()]
