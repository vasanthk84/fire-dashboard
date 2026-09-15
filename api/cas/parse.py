"""
Vercel Python serverless function: POST /api/cas/parse (production).

This is the deployed-site counterpart to the local-dev path (server.js
spawning scripts/parse_cas.py as a subprocess) — Vercel's Node functions
can't spawn a Python subprocess, but Vercel *does* run genuine Python
functions natively (see requirements.txt at the repo root), so this calls
casparser directly in-process instead of shelling out. Same request/response
shape as the local route, so the frontend (src/services/api.ts,
parseCASStatement) needs no changes and no environment-specific branching —
Vite's dev proxy sends /api/cas/parse to the local Express route, Vercel
routes production traffic straight to this file.

Deliberately the low-level `BaseHTTPRequestHandler` style Vercel's Python
runtime supports (rather than Flask/FastAPI) — no framework dependency for
one small endpoint, and it makes reading a raw base64 PDF out of the request
body straightforward.
"""
from http.server import BaseHTTPRequestHandler
import base64
import json
import os
import tempfile


def _parse_cas(pdf_path: str, password: str) -> dict:
    import casparser  # imported lazily so a missing dependency surfaces as a clean JSON error, not a cold-start crash

    try:
        result_json = casparser.read_cas_pdf(pdf_path, password, output="json")
    except Exception as exc:  # noqa: BLE001 — deliberately broad, this is a request-handling boundary
        message = str(exc) or exc.__class__.__name__
        lowered = message.lower()
        if "password" in lowered or "decrypt" in lowered:
            message = "Could not open the PDF — the password looks incorrect (or the file needs one)."
        raise ValueError(message) from exc

    return json.loads(result_json)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 — name required by BaseHTTPRequestHandler
        try:
            content_length = int(self.headers.get("Content-Length", 0) or 0)
            raw_body = self.rfile.read(content_length) if content_length > 0 else b""
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            self._send_json(400, {"error": "Could not read/parse the request body as JSON."})
            return

        file_b64 = payload.get("fileBase64")
        password = payload.get("password") or ""

        if not file_b64 or not isinstance(file_b64, str):
            self._send_json(400, {"error": "Missing fileBase64 in request body."})
            return

        try:
            # Accept both a bare base64 string and a data: URL.
            if "," in file_b64:
                file_b64 = file_b64.split(",", 1)[1]
            pdf_bytes = base64.b64decode(file_b64)
        except Exception:
            self._send_json(400, {"error": "Could not decode fileBase64 as base64."})
            return

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            parsed = _parse_cas(tmp_path, password)
            self._send_json(200, parsed)
        except ImportError:
            self._send_json(500, {"error": "The casparser package is not installed on this deployment."})
        except ValueError as exc:
            self._send_json(422, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"error": str(exc) or "Failed to parse the CAS statement."})
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
