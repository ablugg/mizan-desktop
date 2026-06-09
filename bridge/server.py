"""
Mizan Bridge Server
Runs on the EC2 host (outside the enclave). Accepts HTTP requests from Vercel,
authenticates them via X-Bridge-Token, and forwards to the Nitro Enclave via vsock.

nginx terminates TLS in front of this process (see nginx.conf).
"""

import hmac
import json
import os
import socket
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BRIDGE_SECRET = os.environ.get("BRIDGE_SECRET", "")
ENCLAVE_CID = int(os.environ.get("ENCLAVE_CID", "16"))
ENCLAVE_PORT = int(os.environ.get("ENCLAVE_PORT", "5000"))
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "3001"))

if not BRIDGE_SECRET:
    print("CRITICAL: BRIDGE_SECRET is not set — all requests will be rejected")


# ---------------------------------------------------------------------------
# vsock transport
# ---------------------------------------------------------------------------

def vsock_call(payload: dict, timeout: int = 60) -> dict:
    """Send a length-prefixed JSON request to the enclave via vsock and return the response."""
    sock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((ENCLAVE_CID, ENCLAVE_PORT))
        data = json.dumps(payload).encode()
        sock.sendall(struct.pack(">I", len(data)) + data)

        raw_len = sock.recv(4)
        if len(raw_len) < 4:
            raise ConnectionError("Enclave closed connection before responding")
        msg_len = struct.unpack(">I", raw_len)[0]

        chunks = []
        received = 0
        while received < msg_len:
            chunk = sock.recv(min(4096, msg_len - received))
            if not chunk:
                raise ConnectionError("Enclave closed connection mid-response")
            chunks.append(chunk)
            received += len(chunk)

        return json.loads(b"".join(chunks).decode())
    finally:
        sock.close()


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class BridgeHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Never log request paths or bodies — they contain user messages
        pass

    def is_authorized(self) -> bool:
        if not BRIDGE_SECRET:
            return False  # Reject everything if secret not configured
        token = self.headers.get("X-Bridge-Token", "")
        # Constant-time comparison prevents timing-based token guessing
        return hmac.compare_digest(token.encode(), BRIDGE_SECRET.encode())

    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length)) if length else {}

    # ------------------------------------------------------------------
    # GET endpoints
    # ------------------------------------------------------------------

    def do_GET(self) -> None:
        if not self.is_authorized():
            return self.send_json({"status": "error", "message": "Unauthorized"}, 401)

        if self.path == "/ping":
            return self.send_json({"status": "ok"})

        if self.path == "/public-key":
            result = vsock_call({"action": "get_public_key"})
            return self.send_json(result)

        self.send_json({"status": "error", "message": "Not found"}, 404)

    # ------------------------------------------------------------------
    # POST endpoints
    # ------------------------------------------------------------------

    def do_POST(self) -> None:
        if not self.is_authorized():
            return self.send_json({"status": "error", "message": "Unauthorized"}, 401)

        try:
            body = self.read_body()
        except Exception:
            return self.send_json({"status": "error", "message": "Invalid JSON"}, 400)

        try:
            result = self._dispatch(body)
            self.send_json(result)
        except Exception as e:
            self.send_json({"status": "error", "message": str(e)}, 502)

    def _dispatch(self, body: dict) -> dict:
        if self.path == "/chat":
            payload = {
                "action": "chat",
                "user_id": body["userId"],
                "messages": body["messages"],
                "system_prompt": body.get("systemPrompt", ""),
            }
            # Forward client's ephemeral public key if provided (enables E2E response encryption)
            if body.get("clientPublicKey"):
                payload["client_public_key"] = body["clientPublicKey"]
            return vsock_call(payload)

        if self.path == "/activate":
            return vsock_call({
                "action": "activate",
                "client_public_key": body["client_public_key"],
                "encrypted_payload": body["encrypted_payload"],
            })

        if self.path == "/encrypt":
            return vsock_call({
                "action": "encrypt",
                "user_id": body["userId"],
                "plaintext": body["plaintext"],
            })

        if self.path == "/decrypt":
            return vsock_call({
                "action": "decrypt",
                "user_id": body["userId"],
                "payload": body["payload"],
            })

        if self.path == "/attest":
            return vsock_call({
                "action": "attest",
                "nonce": body.get("nonce", ""),
            })

        return {"status": "error", "message": f"Unknown path: {self.path}"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), BridgeHandler)
    print(f"Bridge listening on 127.0.0.1:{BRIDGE_PORT} (nginx terminates TLS)")
    print(f"Enclave target: CID={ENCLAVE_CID} PORT={ENCLAVE_PORT}")
    print(f"Auth: {'CONFIGURED' if BRIDGE_SECRET else 'MISSING — will reject all requests'}")
    server.serve_forever()


if __name__ == "__main__":
    main()
