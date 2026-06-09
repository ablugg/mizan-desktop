/**
 * Client-side X25519 ECDH activation for Mizan Enclave.
 *
 * Uses the Web Crypto API (SubtleCrypto) — works in browser and Node.js 18+.
 *
 * Activation flow:
 *  1. Fetch enclave's X25519 public key (optionally verified via attestation)
 *  2. Generate ephemeral X25519 keypair locally
 *  3. ECDH → HKDF-SHA256 → AES-256-GCM encryption key
 *  4. Encrypt { api_key, ... } with AES-256-GCM + AAD
 *  5. Send ephemeral public key + ciphertext to enclave
 *  6. Enclave derives the same key, decrypts, stores API key in memory
 *
 * The bridge (host OS) only ever sees encrypted bytes. The enclave's X25519
 * private key never leaves the TEE, so only genuine attested code can decrypt.
 */

export interface EncryptedPayload {
  nonce: string;      // base64-encoded 12-byte AES-GCM nonce
  ciphertext: string; // base64-encoded AES-256-GCM ciphertext + 16-byte tag
}

export interface ActivationPayload {
  clientPublicKey: string;  // base64-encoded ephemeral X25519 public key
  encryptedPayload: EncryptedPayload;
}

// Must match b"mizan-enclave-activation" in enclave/server.py
const ACTIVATION_INFO = new TextEncoder().encode("mizan-enclave-activation");
// Must match b"mizan-response" in enclave/server.py
const RESPONSE_INFO = new TextEncoder().encode("mizan-response");
// 32 zero bytes = RFC 5869 default salt for SHA-256 (matches Python HKDF salt=bytes(32))
const HKDF_SALT = new Uint8Array(32);

/**
 * Build an ECDH-encrypted activation payload for the enclave.
 *
 * @param enclavePublicKeyB64 - base64-encoded enclave X25519 public key
 * @param secrets - object to encrypt (e.g. { api_key: "sk-ant-..." })
 */
export async function buildActivationPayload(
  enclavePublicKeyB64: string,
  secrets: Record<string, string>
): Promise<ActivationPayload> {
  const subtle = globalThis.crypto.subtle;

  // 1. Generate ephemeral X25519 keypair (discarded after this call)
  const ephemeral = (await subtle.generateKey(
    { name: "X25519" } as AlgorithmIdentifier,
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;

  // 2. Import the enclave's raw X25519 public key
  const enclavePubBytes = base64Decode(enclavePublicKeyB64);
  const enclavePublicKey = await subtle.importKey(
    "raw",
    enclavePubBytes,
    { name: "X25519" } as AlgorithmIdentifier,
    false,
    []
  );

  // 3. ECDH: derive 32-byte shared secret
  const sharedBits = await subtle.deriveBits(
    { name: "X25519", public: enclavePublicKey } as AlgorithmIdentifier,
    ephemeral.privateKey,
    256
  );

  // 4. HKDF-SHA256: derive AES-256-GCM key from shared secret
  //    salt=32 zero bytes matches Python HKDF(salt=bytes(32), ...)
  const hkdfKey = await subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  const aesKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: ACTIVATION_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // 5. Encrypt secrets with AES-256-GCM + activation AAD
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(secrets));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: ACTIVATION_INFO },
    aesKey,
    plaintext
  );

  // 6. Export ephemeral public key (sent to enclave so it can derive same secret)
  const clientPubBytes = await subtle.exportKey("raw", ephemeral.publicKey);

  return {
    clientPublicKey: base64Encode(new Uint8Array(clientPubBytes)),
    encryptedPayload: {
      nonce: base64Encode(nonce),
      ciphertext: base64Encode(new Uint8Array(ciphertext)),
    },
  };
}

/**
 * Generate an ephemeral X25519 keypair for client-side response decryption.
 * Call once per session; keep the keypair in memory only (never persisted).
 */
export async function generateClientKeypair(): Promise<CryptoKeyPair> {
  return (await globalThis.crypto.subtle.generateKey(
    { name: "X25519" } as AlgorithmIdentifier,
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
}

const KEYPAIR_STORAGE_KEY = "mizan_x25519_key";

/**
 * Load the persisted X25519 keypair from localStorage, or generate and save a
 * new one. Using the same private key across sessions means enclave responses
 * encrypted in previous sessions can still be decrypted on reload.
 */
export async function loadOrGenerateKeypair(): Promise<CryptoKeyPair> {
  const subtle = globalThis.crypto.subtle;

  try {
    const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
    if (stored) {
      const jwk = JSON.parse(stored) as JsonWebKey;
      // JWK for X25519 private key contains both d (private) and x (public).
      // Build the public JWK by stripping the private component.
      const { d: _d, ...publicJwk } = jwk;
      const [privateKey, publicKey] = await Promise.all([
        subtle.importKey("jwk", jwk, { name: "X25519" } as AlgorithmIdentifier, true, ["deriveBits"]),
        subtle.importKey("jwk", publicJwk, { name: "X25519" } as AlgorithmIdentifier, true, []),
      ]);
      return { privateKey, publicKey };
    }
  } catch {
    // Corrupt entry or unavailable — fall through and regenerate.
  }

  const keypair = await generateClientKeypair();

  try {
    const jwk = await subtle.exportKey("jwk", keypair.privateKey);
    localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(jwk));
  } catch {
    // Storage unavailable — keypair is ephemeral this session only.
  }

  return keypair;
}

/**
 * Export a CryptoKey (public) to base64 for inclusion in API requests.
 */
export async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await globalThis.crypto.subtle.exportKey("raw", key);
  return base64Encode(new Uint8Array(raw));
}

/**
 * Decrypt an enclave response that was encrypted with encrypt_for_client() in server.py.
 *
 * Protocol: X25519 ECDH(clientPrivateKey, enclavePublicKey) → HKDF-SHA256 → AES-256-GCM
 * Mirrors encrypt_for_client() in enclave/server.py.
 *
 * @param encrypted - { ciphertext, nonce } from the enclave response
 * @param clientPrivateKey - the ephemeral private key generated this session
 * @param enclavePublicKeyB64 - base64 enclave X25519 public key (from /api/enclave/public-key)
 */
export async function decryptEnclaveResponse(
  encrypted: { ciphertext: string; nonce: string; salt?: string },
  clientPrivateKey: CryptoKey,
  enclavePublicKeyB64: string
): Promise<string> {
  const subtle = globalThis.crypto.subtle;

  // Import the enclave's static X25519 public key
  const enclavePubBytes = base64Decode(enclavePublicKeyB64);
  const enclavePublicKey = await subtle.importKey(
    "raw",
    enclavePubBytes,
    { name: "X25519" } as AlgorithmIdentifier,
    false,
    []
  );

  // ECDH: derive 32-byte shared secret
  const sharedBits = await subtle.deriveBits(
    { name: "X25519", public: enclavePublicKey } as AlgorithmIdentifier,
    clientPrivateKey,
    256
  );

  // HKDF-SHA256: use the salt from the enclave response if provided,
  // otherwise fall back to 32 zero bytes (original default).
  const hkdfSalt = encrypted.salt ? base64Decode(encrypted.salt) : HKDF_SALT;

  const hkdfKey = await subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  const aesKey = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: RESPONSE_INFO },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // AES-256-GCM decrypt with matching AAD
  const nonce = base64Decode(encrypted.nonce);
  const ciphertext = base64Decode(encrypted.ciphertext);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: RESPONSE_INFO },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

function base64Decode(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
