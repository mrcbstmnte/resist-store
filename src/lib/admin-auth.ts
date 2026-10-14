import { timingSafeEqual } from "node:crypto";

export const ADMIN_REALM = 'Basic realm="RESIST admin", charset="UTF-8"';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Comma-separated lists, paired by position: the first username goes with the first
// password, and so on. Trimmed, since a pasted value with a stray space never matches.
const list = (value: string | undefined) => (value ?? "").split(",").map((s) => s.trim());

type Accounts = { accounts: { user: string; pass: string }[]; error: null } | { accounts: []; error: string };

function adminAccounts(): Accounts {
  const users = list(process.env.ADMIN_USERNAME);
  const passes = list(process.env.ADMIN_PASSWORD);
  if (!process.env.ADMIN_USERNAME?.trim() || !process.env.ADMIN_PASSWORD?.trim()) {
    return { accounts: [], error: "ADMIN_USERNAME and/or ADMIN_PASSWORD is not set." };
  }
  if (users.length !== passes.length) {
    return {
      accounts: [],
      error: `ADMIN_USERNAME lists ${users.length} name${users.length === 1 ? "" : "s"} but ADMIN_PASSWORD lists ${passes.length} password${passes.length === 1 ? "" : "s"}; they're paired in order, so the counts must match.`,
    };
  }
  if (users.some((u) => !u) || passes.some((p) => !p)) {
    return { accounts: [], error: "ADMIN_USERNAME or ADMIN_PASSWORD has an empty entry (check for doubled or trailing commas)." };
  }
  if (new Set(users.map((u) => u.toLowerCase())).size !== users.length) {
    return { accounts: [], error: "ADMIN_USERNAME lists the same name twice." };
  }
  return { accounts: users.map((user, i) => ({ user, pass: passes[i] })), error: null };
}

/** Why admin login can't work with the current settings, or null when it's set up. */
export function adminConfigError() {
  return adminAccounts().error;
}

/** False when the admin settings are missing or malformed, so nobody can log in. */
export function isAdminConfigured() {
  return adminConfigError() === null;
}

/**
 * Checks an `Authorization: Basic …` header against the admin accounts and returns the
 * username that matched, or null.
 */
export function adminFromAuthorization(header: string | null): string | null {
  const { accounts } = adminAccounts();
  if (!accounts.length || !header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  const [user, pass] = [decoded.slice(0, i), decoded.slice(i + 1)];
  // Compare against every account, both halves each time, so timing doesn't reveal
  // which account exists or which half was wrong.
  let match: string | null = null;
  for (const account of accounts) {
    const u = safeEqual(user, account.user);
    const p = safeEqual(pass, account.pass);
    if (u && p) match = account.user;
  }
  return match;
}

export function isAdminAuthorization(header: string | null): boolean {
  return adminFromAuthorization(header) !== null;
}
