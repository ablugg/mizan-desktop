/**
 * Mizan TEE Client
 * In production, routes all sensitive operations through the EC2 bridge
 * which forwards to the Nitro Enclave via vsock.
 *
 * Bridge endpoints required for X25519 activation:
 *   GET  /public-key  → vsock { action: "get_public_key" }
 *   POST /activate    → vsock { action: "activate", client_public_key, encrypted_payload }
 */

const BRIDGE_URL = process.env.ENCLAVE_BRIDGE_URL ?? "http://13.218.104.123:3001";

interface EnclaveResponse {
  status: "ok" | "error";
  message?: string;
  encrypted_response?: { ciphertext: string; nonce: string; salt: string };
  encrypted?: { ciphertext: string; nonce: string; salt: string };
  plaintext?: string;
  attestation?: string;
  public_key?: string;
}

async function bridgeRequest(path: string, body: object, timeoutMs = 30000): Promise<EnclaveResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Shared secret so the bridge can reject unauthenticated callers.
  // Bridge must verify this header — rotate via BRIDGE_SECRET env var.
  if (process.env.BRIDGE_SECRET) headers["X-Bridge-Token"] = process.env.BRIDGE_SECRET;

  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Bridge request failed: ${res.status}`);
  return res.json();
}

export async function enclaveChat(params: {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  clientPublicKey?: string;
}): Promise<{ encryptedResponse: EnclaveResponse["encrypted_response"]; plaintext?: string }> {
  const response = await bridgeRequest("/chat", {
    userId: params.userId,
    messages: params.messages,
    systemPrompt: params.systemPrompt,
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(params.clientPublicKey ? { clientPublicKey: params.clientPublicKey } : {}),
  }, 50000); // 50s — allow time for large document context

  if (response.status !== "ok") throw new Error(response.message ?? "Enclave chat failed");
  return {
    encryptedResponse: response.encrypted_response ?? response.encrypted,
    plaintext: response.plaintext,
  };
}

export async function enclaveEncrypt(userId: string, plaintext: string) {
  const response = await bridgeRequest("/encrypt", { userId, plaintext });
  if (response.status !== "ok") throw new Error(response.message);
  return response.encrypted!;
}

export async function enclaveDecrypt(
  userId: string,
  payload: { ciphertext: string; nonce: string; salt: string }
) {
  const response = await bridgeRequest("/decrypt", { userId, payload });
  if (response.status !== "ok") throw new Error(response.message);
  return response.plaintext!;
}

export async function* enclaveChatStream(params: {
  userId: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  clientPublicKey?: string;
}): AsyncGenerator<{ ciphertext: string; nonce: string; salt?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.BRIDGE_SECRET) headers["X-Bridge-Token"] = process.env.BRIDGE_SECRET;

  const res = await fetch(`${BRIDGE_URL}/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      userId: params.userId,
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(params.clientPublicKey ? { clientPublicKey: params.clientPublicKey } : {}),
    }),
    signal: AbortSignal.timeout(120000), // 2 min for full stream
  });

  if (!res.ok) throw new Error(`Bridge stream request failed: ${res.status}`);
  if (!res.body) throw new Error("No response body from bridge stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as { type: string; encrypted?: { ciphertext: string; nonce: string; salt?: string }; message?: string };
        if (msg.type === "chunk" && msg.encrypted) {
          yield msg.encrypted;
        } else if (msg.type === "done") {
          return;
        } else if (msg.type === "error") {
          throw new Error(msg.message ?? "Enclave stream error");
        }
      } catch {
        // Skip malformed lines
      }
    }
  }
}

export async function pingEnclave(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/ping`);
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Fetch the enclave's X25519 public key.
 * The returned key should be verified against an attestation document
 * before using it to encrypt secrets.
 */
export async function getEnclavePublicKey(): Promise<string> {
  const headers: Record<string, string> = {};
  if (process.env.BRIDGE_SECRET) headers["X-Bridge-Token"] = process.env.BRIDGE_SECRET;
  const res = await fetch(`${BRIDGE_URL}/public-key`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch enclave public key: ${res.status}`);
  const data: EnclaveResponse = await res.json();
  if (data.status !== "ok" || !data.public_key)
    throw new Error(data.message ?? "Missing public_key in response");
  return data.public_key;
}

/**
 * Send an ECDH-encrypted activation payload to the enclave.
 * After this call, the enclave holds the API key in memory and
 * no longer needs it sent per-request.
 */
export async function activateEnclave(payload: {
  clientPublicKey: string;
  encryptedPayload: { nonce: string; ciphertext: string };
}): Promise<void> {
  const response = await bridgeRequest("/activate", {
    client_public_key: payload.clientPublicKey,
    encrypted_payload: payload.encryptedPayload,
  });
  if (response.status !== "ok")
    throw new Error(response.message ?? "Enclave activation failed");
}