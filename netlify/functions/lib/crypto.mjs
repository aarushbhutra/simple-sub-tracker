import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function resolveKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is required");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // fallback to hash flow
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptJson(value) {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const serialized = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  });
}

export function decryptJson(payload) {
  if (!payload) {
    return null;
  }

  const parsed = JSON.parse(payload);
  const key = resolveKey();

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parsed.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
