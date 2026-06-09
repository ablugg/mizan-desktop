import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.FIELD_ENCRYPTION_KEY;

function getKey(): Buffer {
  const k = KEY_HEX?.trim();
  if (!k || k.length !== 64) {
    throw new Error(`FIELD_ENCRYPTION_KEY missing or wrong length (got ${k?.length ?? 0}, need 64)`);
  }
  return Buffer.from(k, "hex");
}

/** Encrypts a string. Returns "iv:authTag:ciphertext" (all hex). */
export function encrypt(value: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a value produced by encrypt().
 * If the value is not in the expected format (e.g. legacy plaintext rows),
 * returns it unchanged so old data still displays.
 */
export function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 3) return value; // legacy plaintext — pass through
  try {
    const [ivHex, tagHex, encHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return value; // decryption failed — return as-is rather than crashing
  }
}
