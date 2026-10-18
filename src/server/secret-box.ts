import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts secrets kept in the database (the Gemini API key) with AES-256-GCM, so a copy of the
 * database alone doesn't reveal them. The key comes from AI_SETTINGS_SECRET, or else from the
 * server's own Firebase private key (always set, never sent to a browser). Server-only.
 */
function key() {
  const secret = process.env.AI_SETTINGS_SECRET || process.env.FIREBASE_PRIVATE_KEY;
  if (!secret) throw new Error("No secret to encrypt with (AI_SETTINGS_SECRET).");
  return createHash("sha256").update(`prep-ai-settings:${secret}`).digest();
}

/** "v1:<iv>:<tag>:<data>", all base64. */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** The secret, or null when it can't be read (another secret was used, or it was tampered with). */
export function open(sealed: string) {
  try {
    const [version, iv, tag, data] = sealed.split(":");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
