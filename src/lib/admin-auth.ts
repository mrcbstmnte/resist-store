import { timingSafeEqual } from "node:crypto";

export const ADMIN_REALM = 'Basic realm="RESIST admin", charset="UTF-8"';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Trimmed: a pasted value with a trailing space or newline otherwise never matches.
const credentials = () => ({
  user: process.env.ADMIN_USERNAME?.trim() ?? "",
  pass: process.env.ADMIN_PASSWORD?.trim() ?? "",
});

/** False when ADMIN_USERNAME or ADMIN_PASSWORD is missing, so nobody can log in. */
export function isAdminConfigured() {
  const { user, pass } = credentials();
  return Boolean(user && pass);
}

/** Validates an `Authorization: Basic …` header against ADMIN_USERNAME / ADMIN_PASSWORD. */
export function isAdminAuthorization(header: string | null): boolean {
  const { user, pass } = credentials();
  if (!user || !pass || !header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  // Evaluate both comparisons so timing doesn't reveal which half was wrong.
  const u = safeEqual(decoded.slice(0, i), user);
  const p = safeEqual(decoded.slice(i + 1), pass);
  return u && p;
}
