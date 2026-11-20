import crypto from 'node:crypto';
import { jwtSecret } from '../config.js';

// RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s step) with a ±1-step verification
// window, plus base32 (RFC 4648) and AES-256-GCM encryption for secrets at
// rest. Secrets never leave the API except once, at enrolment, over TLS.
const STEP_SECONDS = 30;
const DIGITS = 6;
const VERIFY_WINDOW_STEPS = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function createTotpSecret(): string {
  // 20 random bytes = 160 bits, matching typical authenticator apps.
  return base32Encode(crypto.randomBytes(20));
}

// RFC 4226 HOTP: HMAC-SHA1 over the big-endian step counter, dynamic
// truncation, 6 digits.
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function totpCode(secretBase32: string, atMs: number = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / 1000 / STEP_SECONDS));
}

export function verifyTotp(secretBase32: string, code: string, atMs: number = Date.now()): boolean {
  const normalized = String(code).trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  const key = base32Decode(secretBase32);
  if (!key.length) return false;
  const current = Math.floor(atMs / 1000 / STEP_SECONDS);
  for (let drift = -VERIFY_WINDOW_STEPS; drift <= VERIFY_WINDOW_STEPS; drift++) {
    if (hotp(key, current + drift) === normalized) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, email: string): string {
  const label = encodeURIComponent(`Roviel:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: 'Roviel',
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---- Encryption at rest: AES-256-GCM keyed from the server JWT secret ----
// Rotating JWT_SECRET invalidates stored TOTP secrets; users simply re-enrol.
function totpKey(): Buffer {
  return crypto.createHash('sha256').update(`roviel-totp:${jwtSecret()}`).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', totpKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptTotpSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const [version, iv, tag, data] = blob.split('.');
    if (version !== 'v1' || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', totpKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const secret = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    return secret || null;
  } catch {
    return null;
  }
}
