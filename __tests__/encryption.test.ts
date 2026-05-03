/**
 * Unit tests for lib/encryption.ts (AES-256-GCM)
 */

// Mock crypto for consistent test outputs
import { randomBytes } from "crypto";

// Set a valid 32-byte key for tests
const TEST_KEY = "dGVzdC1rZXktMzItYnl0ZXMtZXhhY3RseQ=="; // base64 of "test-key-32-bytes-exactly"

describe("lib/encryption", () => {
  beforeAll(() => {
    // Set up environment before importing the module
    process.env.ENCRYPTION_SECRET = TEST_KEY;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_SECRET;
  });

  describe("encryptKey", () => {
    it("should encrypt a plaintext string", async () => {
      const { encryptKey } = await import("@/lib/encryption");
      const apiKey = "sk-test-1234567890abcdef";

      const encrypted = encryptKey(apiKey);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(apiKey);
      // Should be base64 encoded
      expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    });

    it("should produce different ciphertexts for the same input (due to random IV)", async () => {
      const { encryptKey } = await import("@/lib/encryption");
      const apiKey = "sk-test-same-input";

      const encrypted1 = encryptKey(apiKey);
      const encrypted2 = encryptKey(apiKey);

      // Due to random IV, each encryption should be different
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decryptKey", () => {
    it("should decrypt back to the original plaintext", async () => {
      const { encryptKey, decryptKey } = await import("@/lib/encryption");
      const originalKey = "sk-live-prod-key-12345";

      const encrypted = encryptKey(originalKey);
      const decrypted = decryptKey(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it("should handle various API key formats", async () => {
      const { encryptKey, decryptKey } = await import("@/lib/encryption");
      const testKeys = [
        "sk-1234",
        "sk-proj-abcdefghijklmnopqrstuvwxyz123456",
        "xai-12345678901234567890123456789012",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "key-with-special-chars!@#$%^&*()",
        "unicode-key-日本語-🔑",
      ];

      for (const key of testKeys) {
        const encrypted = encryptKey(key);
        const decrypted = decryptKey(encrypted);
        expect(decrypted).toBe(key);
      }
    });

    it("should throw on invalid encrypted data", async () => {
      const { decryptKey } = await import("@/lib/encryption");

      expect(() => decryptKey("not-valid-base64!")).toThrow();
      expect(() => decryptKey("YWJj")).toThrow("too short"); // "abc" in base64
    });

    it("should throw on tampered data (GCM authentication)", async () => {
      const { encryptKey, decryptKey } = await import("@/lib/encryption");
      const encrypted = encryptKey("original-key");

      // Tamper with the ciphertext
      const buffer = Buffer.from(encrypted, "base64");
      buffer[buffer.length - 1] ^= 0xff; // Flip bits in last byte
      const tampered = buffer.toString("base64");

      expect(() => decryptKey(tampered)).toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw if ENCRYPTION_SECRET is missing", async () => {
      // Clear the module cache and env
      jest.resetModules();
      const originalSecret = process.env.ENCRYPTION_SECRET;
      delete process.env.ENCRYPTION_SECRET;

      try {
        const { encryptKey } = await import("@/lib/encryption");
        expect(() => encryptKey("test")).toThrow("ENCRYPTION_SECRET");
      } finally {
        process.env.ENCRYPTION_SECRET = originalSecret;
      }
    });

    it("should throw if ENCRYPTION_SECRET is wrong length", async () => {
      jest.resetModules();
      const originalSecret = process.env.ENCRYPTION_SECRET;
      process.env.ENCRYPTION_SECRET = "too-short";

      try {
        const { encryptKey } = await import("@/lib/encryption");
        expect(() => encryptKey("test")).toThrow("32 bytes");
      } finally {
        process.env.ENCRYPTION_SECRET = originalSecret;
      }
    });
  });
});
