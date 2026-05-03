import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for sensitive data like API keys.
 *
 * Format: base64(iv:authTag:ciphertext)
 * - iv: 12 bytes (96 bits) - recommended for GCM
 * - authTag: 16 bytes (128 bits) - authentication tag
 * - ciphertext: variable length
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Must be exactly 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET environment variable is required. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  // If it looks like base64, decode it; otherwise use raw bytes
  const key = secret.includes("=") || secret.length === 44
    ? Buffer.from(secret, "base64")
    : Buffer.from(secret, "utf-8");

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_SECRET must be exactly 32 bytes (256 bits). ` +
        `Got ${key.length} bytes. Generate with: openssl rand -base64 32`
    );
  }

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt (e.g., an API key)
 * @returns Base64-encoded string containing iv:authTag:ciphertext
 */
export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString("base64");
}

/**
 * Decrypt a string that was encrypted with encryptKey().
 *
 * @param encryptedData - Base64-encoded string from encryptKey()
 * @returns The original plaintext string
 * @throws Error if decryption fails (wrong key, corrupted data, or tampered)
 */
export function decryptKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted data: too short");
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
