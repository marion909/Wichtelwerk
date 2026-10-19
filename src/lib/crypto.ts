import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function key(name: "ENCRYPTION_KEY" | "PSEUDONYM_PEPPER"): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} ist nicht gesetzt`);
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length < 32) throw new Error(`${name} muss mindestens 32 Byte lang sein (base64 oder hex)`);
  return buf.subarray(0, 32);
}

/** AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("ENCRYPTION_KEY"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Ungültiges Verschlüsselungsformat");
  const decipher = createDecipheriv("aes-256-gcm", key("ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Pseudonym einer E-Mail-Adresse für Vorjahres-Paare (nicht umkehrbar ohne Pepper). */
export function pseudonym(email: string, organizationId: string): string {
  return createHmac("sha256", key("PSEUDONYM_PEPPER"))
    .update(`${organizationId}:${email.trim().toLowerCase()}`)
    .digest("hex");
}
