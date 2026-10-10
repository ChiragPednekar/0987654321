/**
 * The sealed backup format, shared by scripts/backup-db.ts (seal) and
 * scripts/decrypt-backup.ts (open), and round-tripped in
 * tests/backup-format.test.ts.
 *
 * Layout: MAGIC | salt(16) | iv(12) | tag(16) | AES-256-GCM(gzip(json))
 *
 * The salt and IV are random per file, so two backups of identical data share
 * nothing, and the key is stretched with scrypt so a weak-ish passphrase still
 * costs an attacker real work per guess. GCM's tag means a truncated, damaged
 * or tampered file refuses to open rather than restoring something wrong.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

const MAGIC = Buffer.from("CCBK1");
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function seal(data: unknown, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, SCRYPT);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(data)))), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function open(file: Buffer, passphrase: string): unknown {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a CaseCode backup (wrong header).");
  }
  let o = MAGIC.length;
  const salt = file.subarray(o, (o += 16));
  const iv = file.subarray(o, (o += 12));
  const tag = file.subarray(o, (o += 16));
  const body = file.subarray(o);

  const key = scryptSync(passphrase, salt, 32, SCRYPT);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // GCM cannot tell a wrong passphrase from a damaged file, so say both.
    throw new Error("Could not decrypt: wrong passphrase, or the file is damaged.");
  }
  return JSON.parse(gunzipSync(plain).toString("utf8"));
}
