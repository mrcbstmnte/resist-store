import { cookies } from "next/headers";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { variants } from "@/db/schema";
import { stockLevels } from "./inventory";

const COOKIE = "resist_cart";
export type CartMap = Record<string, number>; // variantId -> qty

export async function readCart(): Promise<CartMap> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: CartMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const q = Math.floor(Number(v));
      if (/^\d+$/.test(k) && q > 0) out[k] = Math.min(q, 99);
    }
    return out;
  } catch {
    return {};
  }
}

export async function writeCart(cart: CartMap) {
  (await cookies()).set(COOKIE, JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearCart() {
  (await cookies()).delete(COOKIE);
}

export async function cartCount() {
  return Object.values(await readCart()).reduce((a, b) => a + b, 0);
}

export async function cartDetails() {
  const cart = await readCart();
  const ids = Object.keys(cart).map(Number);
  if (ids.length === 0) return { lines: [], subtotalCents: 0, count: 0 };
  const [rows, levels] = await Promise.all([
    db.query.variants.findMany({ where: inArray(variants.id, ids), with: { product: true } }),
    stockLevels(ids),
  ]);
  const lines = rows
    .filter((v) => v.product.active)
    .map((v) => {
      const quantity = cart[String(v.id)];
      return {
        variant: v,
        product: v.product,
        quantity,
        available: levels.get(v.id)?.available ?? 0,
        lineCents: v.product.priceCents * quantity,
      };
    })
    .sort((a, b) => a.variant.id - b.variant.id);
  return {
    lines,
    subtotalCents: lines.reduce((s, l) => s + l.lineCents, 0),
    count: lines.reduce((s, l) => s + l.quantity, 0),
  };
}
