#!/usr/bin/env python3
"""Stream one ja3proxy request using only the Python standard library."""

import argparse
import http.client
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from urllib.parse import urlsplit
from uuid import uuid4

MEDIA_TYPE = "application/vnd.ja3proxy"
FRAME_LIMIT = 65_536


def frame(kind, payload=b""):
    if len(payload) > FRAME_LIMIT:
        raise ValueError("Ein Frame überschreitet das Größenlimit.")
    return struct.pack(">BI", kind, len(payload)) + payload


def read_exact(response, length):
    data = bytearray()
    while len(data) < length:
        chunk = response.read(length - len(data))
        if not chunk:
            raise ValueError("Der Antwortstream ist unvollständig.")
        data.extend(chunk)
    return bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Upstream HTTP(S) URL")
    parser.add_argument("--partition", required=True, help="Opaque isolation key")
    exit_choice = parser.add_mutually_exclusive_group(required=True)
    exit_choice.add_argument("--direct", action="store_true")
    exit_choice.add_argument("--proxy", help="HTTP(S) or SOCKS proxy URL")
    exit_choice.add_argument("--context", help="Existing context ID")
    parser.add_argument("--profile", help="TLS profile for a new connection (default: chrome_149)")
    parser.add_argument("--no-emulate-headers", action="store_true")
    parser.add_argument("--user-agent")
    parser.add_argument("--method", default="GET")
    parser.add_argument("-H", "--header", action="append", default=[])
    body_choice = parser.add_mutually_exclusive_group()
    body_choice.add_argument("--data", help="UTF-8 request body")
    body_choice.add_argument("--data-file", type=Path, help="Raw upload file")
    parser.add_argument("--timeout", type=int, default=30, help="Total service budget in seconds")
    parser.add_argument("--max-response-bytes", type=int, default=2_097_152)
    parser.add_argument("--output", type=Path, help="Atomically replace this file after successful transport")
    args = parser.parse_args()
    token = os.environ.get("JA3_PROXY_TOKEN", "")
    if not 32 <= len(token) <= 4096 or any(not 33 <= ord(char) <= 126 for char in token):
        raise ValueError("JA3_PROXY_TOKEN muss ein eigenes Dienstgeheimnis enthalten.")
    base = urlsplit(os.environ.get("JA3_PROXY_URL", "http://127.0.0.1:8080"))
    if base.scheme not in ("http", "https") or not base.hostname or base.username or base.password or base.query or base.fragment:
        raise ValueError("JA3_PROXY_URL ist ungültig.")
    if args.timeout <= 0 or args.max_response_bytes <= 0:
        raise ValueError("Zeit- und Größenlimits müssen positiv sein.")
    if args.context and (args.user_agent or args.no_emulate_headers or args.profile is not None):
        raise ValueError("Die Identität eines bestehenden Kontexts ist unveränderlich.")
    connection_type = http.client.HTTPSConnection if base.scheme == "https" else http.client.HTTPConnection
    connection = connection_type(base.hostname, base.port, timeout=args.timeout + 5)
    prefix = base.path.rstrip("/")
    temporary_path = None
    sink = None
    try:
        auth = {"Authorization": "Bearer " + token}
        connection.request("GET", prefix + "/capabilities", headers=auth)
        response = connection.getresponse()
        capabilities_body = response.read(1_048_577)
        if response.status != 200 or len(capabilities_body) > 1_048_576:
            raise ValueError("Die Transportfähigkeiten konnten nicht geladen werden.")
        capabilities = json.loads(capabilities_body)
        if not isinstance(capabilities, dict) or capabilities.get("service") != "ja3proxy":
            raise ValueError("Der Dienst unterstützt den erforderlichen Transportvertrag nicht.")
        framing = capabilities.get("framing")
        if not isinstance(framing, dict) or framing.get("contentType") != MEDIA_TYPE:
            raise ValueError("Der Dienst unterstützt den erforderlichen Transportvertrag nicht.")
        limits = capabilities["limits"]
        if args.timeout * 1000 > limits["maxTimeoutMs"] or args.max_response_bytes > limits["maxResponseBytes"]:
            raise ValueError("Das angeforderte Budget überschreitet die Dienstgrenzen.")
        headers = []
        for value in args.header:
            name, separator, content = value.partition(":")
            if not separator or not name.strip():
                raise ValueError("Header müssen als Name: Wert angegeben werden.")
            headers.append([name.strip(), content.strip()])
        data = args.data.encode("utf-8") if args.data is not None else None
        size = args.data_file.stat().st_size if args.data_file else len(data or b"")
        if size > limits["maxRequestBytes"]:
            raise ValueError("Der Upload überschreitet die Dienstgrenze.")
        metadata = {
            "requestId": str(uuid4()), "partition": args.partition,
            "url": args.url, "method": args.method.upper(), "headers": headers,
            "hasBody": data is not None or args.data_file is not None,
            "bodyLength": size, "timeoutMs": args.timeout * 1000,
            "maxResponseBytes": args.max_response_bytes, "attempt": 0,
        }
        if args.context:
            metadata["contextId"] = args.context
        else:
            profile = args.profile or "chrome_149"
            if profile not in capabilities["profiles"]:
                raise ValueError("Das TLS-Profil ist nicht verfügbar; siehe /capabilities.")
            identity = {"tlsProfile": profile, "emulateHeaders": not args.no_emulate_headers}
            if args.user_agent:
                identity["userAgent"] = args.user_agent
            metadata["connection"] = {
                "egress": {"mode": "proxy", "url": args.proxy} if args.proxy else {"mode": "direct"},
                "identity": identity,
            }

        def upload():
            yield frame(1, json.dumps(metadata, separators=(",", ":")).encode())
            if args.data_file:
                with args.data_file.open("rb") as source:
                    while chunk := source.read(FRAME_LIMIT):
                        yield frame(2, chunk)
            elif data is not None:
                for offset in range(0, len(data), FRAME_LIMIT):
                    yield frame(2, data[offset:offset + FRAME_LIMIT])
            yield frame(3)

        print(json.dumps({"requestId": metadata["requestId"]}), file=sys.stderr, flush=True)
        connection.request("POST", prefix + "/request", body=upload(),
                           headers={**auth, "Content-Type": MEDIA_TYPE}, encode_chunked=True)
        response = connection.getresponse()
        if response.status != 200:
            # Do not print arbitrary service/proxy bodies or credentials to logs.
            raise ValueError(f"Der Transportdienst antwortete mit HTTP {response.status}.")
        if response.getheader("Content-Type", "").split(";", 1)[0].strip() != MEDIA_TYPE:
            raise ValueError("Der Antworttyp entspricht nicht dem Transportvertrag.")
        if args.output:
            sink = tempfile.NamedTemporaryFile(mode="wb", dir=args.output.resolve().parent, delete=False)
            temporary_path = Path(sink.name)
        else:
            sink = sys.stdout.buffer
        status = None
        received = 0
        while True:
            kind, length = struct.unpack(">BI", read_exact(response, 5))
            if length > FRAME_LIMIT or kind not in (1, 2, 3, 4):
                raise ValueError("Der Antwortframe ist ungültig.")
            payload = read_exact(response, length)
            if kind == 2:
                if status is None or received + length > args.max_response_bytes:
                    raise ValueError("Antwortreihenfolge oder Größenlimit verletzt.")
                sink.write(payload)
                received += length
                continue
            value = json.loads(payload)
            if not isinstance(value, dict):
                raise ValueError("Die Antwortmetadaten sind ungültig.")
            if kind == 4:
                code = value.get("code", "UNKNOWN")
                allowed_codes = {
                    "UNAUTHORIZED", "INVALID_REQUEST", "UNSUPPORTED_CAPABILITY", "INVALID_PROFILE",
                    "EGRESS_REQUIRED", "SSRF_BLOCKED", "BODY_TOO_LARGE", "BUSY", "TIMEOUT",
                    "CANCELLED", "DNS_ERROR", "PROXY_ERROR", "TLS_ERROR", "CONNECT_ERROR",
                    "PROTOCOL_ERROR", "CONTEXT_NOT_FOUND", "CONTEXT_CONFLICT", "CONTEXT_LIMIT",
                    "COOKIE_LIMIT", "DUPLICATE_REQUEST", "UNKNOWN",
                }
                if not isinstance(code, str) or code not in allowed_codes:
                    code = "UNKNOWN"
                raise ValueError(f"Transportfehler: {code}. Ein Schreibaufruf darf nicht ungeprüft wiederholt werden.")
            if value.get("requestId") != metadata["requestId"]:
                raise ValueError("Die Antwort gehört zu einer anderen Anfrage.")
            if kind == 1:
                if status is not None or not isinstance(value.get("status"), int) or not 200 <= value["status"] <= 599:
                    raise ValueError("Die Antwortmetadaten sind ungültig.")
                status = value["status"]
                continue
            if status is None or value.get("responseBytes") != received or response.read(1):
                raise ValueError("Der Stream-Abschluss ist ungültig.")
            sink.flush()
            if args.output:
                sink.close()
                os.replace(temporary_path, args.output)
                temporary_path = None
            print(json.dumps({"status": status, "bytes": received, "requestId": metadata["requestId"]}), file=sys.stderr)
            return 0 if 200 <= status < 300 else 2
    finally:
        connection.close()
        if args.output and sink is not None:
            sink.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, http.client.HTTPException, KeyError, TypeError) as error:
        # Error details from remote bodies are deliberately not echoed.
        print(f"Anfrage fehlgeschlagen: {error}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("Anfrage abgebrochen.", file=sys.stderr)
        sys.exit(130)
