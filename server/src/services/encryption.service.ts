import crypto from "crypto";
import { env } from "../config/env";

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor(secretKey?: string) {
    // Derive a fixed 32-byte key using SHA-256
    const secret =
      secretKey ||
      (process.env.ENCRYPTION_SECRET as string) ||
      (env as any)?.JWT_SECRET ||
      "nova-default-secure-vault-key-32chars!";
    this.key = crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * Encrypts a plaintext string with AES-256-GCM using a unique random IV
   */
  public encrypt(plainText: string): EncryptedPayload {
    const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let cipherText = cipher.update(plainText, "utf8", "hex");
    cipherText += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return {
      cipherText,
      iv: iv.toString("hex"),
      tag,
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload
   */
  public decrypt(payload: EncryptedPayload): string {
    if (!payload || !payload.cipherText || !payload.iv || !payload.tag) {
      throw new Error("Invalid encrypted payload structure");
    }

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(payload.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
    let decrypted = decipher.update(payload.cipherText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Serializes and encrypts an arbitrary JavaScript object/dictionary
   */
  public encryptObject(obj: Record<string, unknown>): EncryptedPayload {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypts and deserializes a previously encrypted JSON object
   */
  public decryptObject<T = Record<string, string>>(payload: EncryptedPayload): T {
    const raw = this.decrypt(payload);
    return JSON.parse(raw) as T;
  }

  /**
   * Masks a sensitive credential string for safe UI presentation
   */
  public mask(secret: string): string {
    if (!secret || typeof secret !== "string") {
      return "";
    }
    const trimmed = secret.trim();
    if (trimmed.length <= 6) {
      return "••••••••";
    }

    // Preserve common prefixes e.g. ghp_, xoxb-, ntn_
    const prefixMatch = trimmed.match(/^([a-zA-Z0-9]+_|[a-zA-Z0-9]+-)/);
    const prefix = prefixMatch ? prefixMatch[0] : trimmed.slice(0, 2);
    const suffix = trimmed.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }
}

export const encryptionService = new EncryptionService();
