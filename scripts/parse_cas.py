#!/usr/bin/env python3
"""
Bridge script spawned by server.js's /api/cas/parse endpoint.

Usage: python3 parse_cas.py <path-to-pdf>
Password (optional) is read from the CAS_PASSWORD env var rather than argv,
so it never shows up in a process list.

Prints the parsed CAS as JSON to stdout on success.
On failure, prints {"error": "<message>"} to stdout and exits with code 1 —
server.js reads stdout either way rather than relying on stderr, since
casparser/pdfminer can be noisy on stderr even on a successful parse.
"""
import json
import os
import sys

# Windows can default stdout/stderr to a non-UTF-8 codepage (e.g. cp1252) when
# piped to a subprocess — which is exactly how server.js runs this script —
# rather than a real console. A PDF-extracted CAS can contain stray non-ASCII
# text pdfminer decoded (observed on a real statement: a lone U+FFFE
# noncharacter, presumably a PDF text-extraction artifact), and writing that
# through a cp1252 stream raises UnicodeEncodeError — which, being itself an
# uncaught-exception traceback print, can *also* fail to display cleanly for
# the same reason, producing exactly the garbled/truncated error a user sees.
# Reconfiguring both streams to UTF-8 up front fixes our own JSON output and
# Python's default traceback printer alike.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_cas.py <path-to-pdf>"}))
        return 1

    pdf_path = sys.argv[1]
    password = os.environ.get("CAS_PASSWORD", "")

    try:
        import casparser
    except ImportError:
        print(json.dumps({
            "error": "The casparser Python package is not installed. Run: pip install casparser "
                     "(or pip3 install casparser --break-system-packages on newer systems)."
        }))
        return 1

    try:
        result_json = casparser.read_cas_pdf(pdf_path, password, output="json")
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a CLI bridge
        message = str(exc) or exc.__class__.__name__
        # casparser/pypdf raise fairly opaque errors for a wrong password; give
        # the user a clearer hint in that common case.
        lowered = message.lower()
        if "password" in lowered or "decrypt" in lowered:
            message = "Could not open the PDF — the password looks incorrect (or the file needs one)."
        print(json.dumps({"error": message}))
        return 1

    # casparser's output="json" already returns a JSON string; print as-is so
    # server.js can pipe stdout straight through without a re-encode.
    sys.stdout.write(result_json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
