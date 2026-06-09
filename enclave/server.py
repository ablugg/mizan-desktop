"""
Mizan Enclave Server
Runs inside AWS Nitro Enclave. Handles:
- Claude API calls
- Key derivation (Scrypt)
- Encryption/decryption (ChaCha20-Poly1305)
- X25519 ECDH activation (client provisions API key securely)
- Attestation document generation

Communication: vsock only (no network, no persistent storage)
"""

import json
import os
import socket
import ssl
import struct
import base64
import hashlib
import http.client
import secrets
from typing import Any

# Symmetric encryption
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305, AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

# X25519 ECDH + HKDF for activation
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization

import anthropic
import httpx

# vsock constants
VSOCK_PORT = 5000
VSOCK_CID_ANY = 0xFFFFFFFF
VSOCK_PARENT_CID = 3  # Host CID is always 3 in Nitro Enclaves


# ---------------------------------------------------------------------------
# Custom httpx transport: HTTPS over vsock
# ---------------------------------------------------------------------------
# Nitro Enclaves have no network. The host runs:
#   vsock-proxy --num_workers 4 8443 api.anthropic.com 443
# We open a vsock socket to the parent (CID=3, port=8443) and wrap it
# with TLS — TLS terminates at api.anthropic.com, not at the host.
# No subprocess, no loopback, no /etc/hosts needed.
# ---------------------------------------------------------------------------

def _make_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except Exception:
        pass  # fall back to system CAs already loaded
    return ctx


_SSL_CTX = _make_ssl_context()


def _vsock_https_request(
    method: str,
    path: str,
    headers: dict,
    body: bytes,
    hostname: str = "api.anthropic.com",
) -> tuple[int, dict, bytes]:
    """
    Send a single HTTPS request over a vsock socket to the host proxy.
    Returns (status_code, response_headers_dict, response_body_bytes).
    """
    raw = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    raw.settimeout(120)
    raw.connect((VSOCK_PARENT_CID, 8443))
    tls = _SSL_CTX.wrap_socket(raw, server_hostname=hostname)

    try:
        # Build and send HTTP/1.1 request
        req_line = f"{method} {path} HTTP/1.1\r\n"
        hdrs = {**headers, "Host": hostname, "Connection": "close"}
        if body:
            hdrs["Content-Length"] = str(len(body))
        hdr_block = "".join(f"{k}: {v}\r\n" for k, v in hdrs.items())
        tls.sendall((req_line + hdr_block + "\r\n").encode())
        if body:
            tls.sendall(body)

        # Read full response
        buf = b""
        while True:
            chunk = tls.recv(65536)
            if not chunk:
                break
            buf += chunk
    finally:
        try:
            tls.close()
        except Exception:
            pass
        try:
            raw.close()
        except Exception:
            pass

    # Parse status line + headers
    sep = buf.find(b"\r\n\r\n")
    head_raw, body_raw = buf[:sep].decode(), buf[sep + 4:]
    lines = head_raw.split("\r\n")
    status_code = int(lines[0].split(" ", 2)[1])
    resp_headers: dict = {}
    for ln in lines[1:]:
        if ": " in ln:
            k, _, v = ln.partition(": ")
            resp_headers[k.lower()] = v

    # Decode chunked transfer encoding if needed
    if resp_headers.get("transfer-encoding", "").lower() == "chunked":
        body_raw = _decode_chunked(body_raw)

    return status_code, resp_headers, body_raw


def _decode_chunked(data: bytes) -> bytes:
    out = b""
    while data:
        crlf = data.find(b"\r\n")
        if crlf == -1:
            break
        size = int(data[:crlf], 16)
        if size == 0:
            break
        out += data[crlf + 2: crlf + 2 + size]
        data = data[crlf + 2 + size + 2:]
    return out


class _VsockTransport(httpx.BaseTransport):
    """Routes every HTTPS request through vsock to the host vsock-proxy."""

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        path = request.url.raw_path.decode()
        headers = {k.decode(): v.decode() for k, v in request.headers.raw
                   if k.lower() not in (b"host", b"connection", b"content-length")}
        body = request.content

        status, resp_headers, resp_body = _vsock_https_request(
            method=request.method,
            path=path,
            headers=headers,
            body=body,
            hostname=request.url.host,
        )
        return httpx.Response(
            status_code=status,
            headers=list(resp_headers.items()),
            content=resp_body,
        )

# Enclave-only master key — generated at startup, never leaves enclave
MASTER_KEY = secrets.token_bytes(32)

# X25519 keypair for ECDH activation — private key never leaves enclave
_X25519_PRIVATE = X25519PrivateKey.generate()
_X25519_PUBLIC = _X25519_PRIVATE.public_key()

# API key provisioned via ECDH activation (None until activate action is called)
ACTIVE_API_KEY: str | None = None


def derive_key(user_id: str, salt: bytes) -> bytes:
    """
    Derive a per-user encryption key using Scrypt (stronger than PBKDF2).
    Key derivation happens only inside the enclave.
    """
    kdf = Scrypt(
        salt=salt,
        length=32,
        n=2**14,
        r=8,
        p=1,
    )
    return kdf.derive(MASTER_KEY + user_id.encode())


def encrypt(plaintext: str, user_id: str) -> dict:
    """Encrypt plaintext with ChaCha20-Poly1305."""
    salt = secrets.token_bytes(32)
    key = derive_key(user_id, salt)
    nonce = secrets.token_bytes(12)
    
    chacha = ChaCha20Poly1305(key)
    ciphertext = chacha.encrypt(nonce, plaintext.encode(), None)
    
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "salt": base64.b64encode(salt).decode(),
    }


def decrypt(payload: dict, user_id: str) -> str:
    """Decrypt ChaCha20-Poly1305 ciphertext."""
    salt = base64.b64decode(payload["salt"])
    nonce = base64.b64decode(payload["nonce"])
    ciphertext = base64.b64decode(payload["ciphertext"])
    
    key = derive_key(user_id, salt)
    chacha = ChaCha20Poly1305(key)
    return chacha.decrypt(nonce, ciphertext, None).decode()


def call_claude(messages: list, system_prompt: str, api_key: str) -> str:
    """
    Call Claude API from inside the enclave via vsock→host proxy→Anthropic.
    TLS is end-to-end: the host only sees encrypted bytes.
    """
    http_client = httpx.Client(transport=_VsockTransport(), verify=False)
    client = anthropic.Anthropic(api_key=api_key, http_client=http_client)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text if response.content else ""


def ecdh_derive_key(client_public_raw: bytes) -> bytes:
    """
    Perform X25519 ECDH with the client's ephemeral public key,
    then derive a 32-byte AES-256-GCM key via HKDF-SHA256.
    """
    client_public = X25519PublicKey.from_public_bytes(client_public_raw)
    shared_secret = _X25519_PRIVATE.exchange(client_public)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        # 32 zero bytes = RFC 5869 default when salt is omitted for SHA-256
        salt=bytes(32),
        info=b"mizan-enclave-activation",
    )
    return hkdf.derive(shared_secret)


def get_enclave_public_key() -> str:
    """Return the enclave's X25519 public key as base64."""
    pub_bytes = _X25519_PUBLIC.public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    )
    return base64.b64encode(pub_bytes).decode()


def encrypt_for_client(plaintext: str, client_public_key_raw: bytes) -> dict:
    """
    Encrypt a response using the client's ephemeral X25519 public key.
    Only the browser that generated the corresponding private key can decrypt.
    The Vercel server and bridge are excluded from reading this.

    Protocol: X25519 ECDH → HKDF-SHA256 → AES-256-GCM
    (Mirrors decryptEnclaveResponse in lib/enclave-activation.ts)
    """
    client_public = X25519PublicKey.from_public_bytes(client_public_key_raw)
    shared_secret = _X25519_PRIVATE.exchange(client_public)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=bytes(32),  # 32 zero bytes — matches JS HKDF_SALT
        info=b"mizan-response",
    )
    key = hkdf.derive(shared_secret)
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), b"mizan-response")
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode(),
    }


def get_attestation_document(nonce: bytes) -> bytes:
    """
    Request an attestation document from the Nitro Security Module (NSM).
    The document cryptographically proves:
      - Which code is running (PCR0/1/2 measurements of the enclave image)
      - The enclave's X25519 public key (embedded in user_data)
      - The nonce (replay protection for the client)

    Clients should verify this document against the AWS Nitro root certificate
    before trusting the X25519 public key for ECDH key exchange.
    """
    pub_bytes = _X25519_PUBLIC.public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    )

    try:
        from aws_nitro_enclaves_nsm_api.api import nsm_get_attestation_doc  # type: ignore
        # user_data embeds our public key so the attestation is bound to this keypair.
        # A client verifying the attestation doc can extract and trust this key.
        return nsm_get_attestation_doc(
            nonce=nonce,
            user_data=pub_bytes,
            public_key=None,
        )
    except Exception as e:
        print(f"[enclave] NSM attestation unavailable: {e}")
        return b""


def handle_request(request: dict) -> dict:
    """Route incoming requests to the appropriate handler."""
    global ACTIVE_API_KEY
    action = request.get("action")

    if action == "get_public_key":
        # Return enclave's X25519 public key so client can perform ECDH.
        # In production this is paired with an attestation document so the
        # client can verify the exact code running before provisioning secrets.
        return {"status": "ok", "public_key": get_enclave_public_key()}

    elif action == "activate":
        # ECDH activation: client sends its ephemeral X25519 public key +
        # AES-256-GCM ciphertext (encrypted with ECDH-derived key).
        # The bridge (host) sees only encrypted bytes — never the API key.
        client_pub_raw = base64.b64decode(request["client_public_key"])
        nonce = base64.b64decode(request["encrypted_payload"]["nonce"])
        ciphertext = base64.b64decode(request["encrypted_payload"]["ciphertext"])

        derived_key = ecdh_derive_key(client_pub_raw)
        aesgcm = AESGCM(derived_key)
        # AAD must match what the client used during encryption
        plaintext = aesgcm.decrypt(nonce, ciphertext, b"mizan-enclave-activation")
        secrets_obj = json.loads(plaintext.decode())
        ACTIVE_API_KEY = secrets_obj["api_key"]
        return {"status": "ok", "message": "Enclave activated"}

    elif action == "chat":
        user_id = request["user_id"]
        api_key = ACTIVE_API_KEY or request.get("api_key")
        if not api_key:
            return {"status": "error", "message": "Enclave not activated — call activate first"}
        messages = request["messages"]
        system_prompt = request.get("system_prompt", "")
        client_public_key_b64 = request.get("client_public_key")

        response_text = call_claude(messages, system_prompt, api_key)

        if client_public_key_b64:
            # Client-key encryption: only the browser can decrypt — Vercel is excluded
            client_pub_raw = base64.b64decode(client_public_key_b64)
            encrypted = encrypt_for_client(response_text, client_pub_raw)
        else:
            # Fallback: server-side key (Vercel can decrypt — less secure)
            encrypted = encrypt(response_text, user_id)

        return {"status": "ok", "encrypted_response": encrypted}

    elif action == "encrypt":
        user_id = request["user_id"]
        plaintext = request["plaintext"]
        encrypted = encrypt(plaintext, user_id)
        return {"status": "ok", "encrypted": encrypted}

    elif action == "decrypt":
        user_id = request["user_id"]
        payload = request["payload"]
        plaintext = decrypt(payload, user_id)
        return {"status": "ok", "plaintext": plaintext}

    elif action == "attest":
        nonce = base64.b64decode(request.get("nonce", ""))
        doc = get_attestation_document(nonce)
        # Include the enclave's X25519 public key in the attestation response
        # so clients can verify the key belongs to attested code
        return {
            "status": "ok",
            "attestation": base64.b64encode(doc).decode(),
            "public_key": get_enclave_public_key(),
        }

    else:
        return {"status": "error", "message": f"Unknown action: {action}"}


def recv_message(sock: socket.socket) -> dict:
    """Read a length-prefixed JSON message from vsock."""
    raw_len = sock.recv(4)
    if not raw_len:
        raise ConnectionError("Connection closed")
    msg_len = struct.unpack(">I", raw_len)[0]
    data = b""
    while len(data) < msg_len:
        chunk = sock.recv(min(4096, msg_len - len(data)))
        if not chunk:
            raise ConnectionError("Connection closed mid-message")
        data += chunk
    return json.loads(data.decode())


def send_message(sock: socket.socket, message: dict):
    """Send a length-prefixed JSON message over vsock."""
    data = json.dumps(message).encode()
    sock.sendall(struct.pack(">I", len(data)) + data)


def main():
    """Start the vsock server inside the enclave."""
    print(f"Mizan enclave starting on vsock port {VSOCK_PORT}")
    print(f"[net] Using vsock transport: CID={VSOCK_PARENT_CID}, port=8443 → api.anthropic.com:443")

    server = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    server.bind((VSOCK_CID_ANY, VSOCK_PORT))
    server.listen(5)
    
    print("Enclave ready, waiting for connections...")
    
    while True:
        conn, addr = server.accept()
        try:
            request = recv_message(conn)
            response = handle_request(request)
            send_message(conn, response)
        except Exception as e:
            send_message(conn, {"status": "error", "message": str(e)})
        finally:
            conn.close()


if __name__ == "__main__":
    main()
