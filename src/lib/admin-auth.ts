import { timingSafeEqual } from "node:crypto";

export const ADMIN_REALM = 'Basic realm="RESIST admin", charset="UTF-8"';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Validates an `Authorization: Basic …` header against ADMIN_USERNAME / ADMIN_PASSWORD. */
export function isAdminAuthorization(header: string | null): boolean {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || !header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  // Evaluate both comparisons so timing doesn't reveal which half was wrong.
  const u = safeEqual(decoded.slice(0, i), user);
  const p = safeEqual(decoded.slice(i + 1), pass);
  return u && p;
}
