"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { deliverySchema } from "@/lib/address";
import { readCart, writeCart, cartDetails } from "@/lib/cart";
import {
  attachCheckoutSession,
  cancelPendingOrder,
  createPendingOrder,
  markOrderPaid,
  InsufficientStockError,
  stockLevels,
} from "@/lib/inventory";
import { createCheckoutSession, paymentMode } from "@/lib/paymongo";
import { sendOrderConfirmation } from "@/lib/notify";

export type FormState = {
  error?: string;
  ok?: string;
  /** Per-field messages for the checkout form */
  fieldErrors?: Record<string, string>;
  /** Echo of submitted values so the form keeps them after a failed submit */
  values?: Record<string, string>;
} | null;

export async function addToCart(_: FormState, form: FormData): Promise<FormState> {
  const variantId = Number(form.get("variantId"));
  const qty = Math.max(1, Math.floor(Number(form.get("quantity") ?? 1)));
  if (!variantId) return { error: "Pick a size first." };

  const cart = await readCart();
  const want = (cart[variantId] ?? 0) + qty;
  const available = (await stockLevels([variantId])).get(variantId)?.available ?? 0;
  if (available <= 0) return { error: "That size just sold out." };
  if (want > available) return { error: `Only ${available} left — you already have ${cart[variantId] ?? 0} in your bag.` };

  cart[variantId] = want;
  await writeCart(cart);
  refresh();
  return { ok: "Added to bag" };
}

export async function setCartQuantity(form: FormData) {
  const variantId = String(Number(form.get("variantId")));
  const qty = Math.floor(Number(form.get("quantity")));
  const cart = await readCart();
  if (!qty || qty < 1) delete cart[variantId];
  else cart[variantId] = Math.min(qty, 99);
  await writeCart(cart);
  refresh();
}


async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function checkout(_: FormState, form: FormData): Promise<FormState> {
  const parsed = deliverySchema.safeParse(Object.fromEntries(form));
  const values = Object.fromEntries(
    [...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]),
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  if (paymentMode() === "off") return { error: "Checkout isn't open yet. Please check back soon.", values };
  const { lines } = await cartDetails();
  if (lines.length === 0) return { error: "Your bag is empty." };

  let created;
  try {
    created = await createPendingOrder(
      parsed.data,
      lines.map((l) => ({ variantId: l.variant.id, quantity: l.quantity })),
    );
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      const names = e.shortages
        .map((s) => {
          const l = lines.find((x) => x.variant.id === s.variantId);
          const label = l ? `${l.product.name} (size ${l.variant.size})` : "An item";
          return s.available === 0 ? `${label} sold out` : `${label}: only ${s.available} left`;
        })
        .join("; ");
      refresh();
      return { error: `${names}. Update your bag and try again.`, values };
    }
    throw e;
  }

  const { order, items } = created;
  let destination: string;

  if (paymentMode() === "mock") {
    destination = `/checkout/mock/${order.id}`;
  } else {
    const base = await baseUrl();
    try {
      const session = await createCheckoutSession({
        reference: order.reference,
        customer: parsed.data,
        items,
        successUrl: `${base}/checkout/success?order=${order.id}`,
        cancelUrl: `${base}/checkout/cancel?order=${order.id}`,
      });
      await attachCheckoutSession(order.id, session.id);
      destination = session.url;
    } catch (e) {
      console.error(e);
      await cancelPendingOrder(order.id);
      return { error: "We couldn't reach the payment provider. Your bag is saved — try again in a moment.", values };
    }
  }

  // The bag is cleared on /checkout/success, so a cancelled payment keeps it intact.
  redirect(destination);
}

// ── Mock payment (only active when PAYMONGO_SECRET_KEY is unset) ────────────
// These redirect straight to pages: a server-action redirect is a client-side
// navigation and can't land on a route handler like /checkout/success.
export async function mockPay(form: FormData) {
  if (paymentMode() !== "mock") throw new Error("Mock payments are disabled");
  const id = String(form.get("orderId"));
  const res = await markOrderPaid({ orderId: id });
  if (res.ok) {
    await writeCart({});
    await sendOrderConfirmation(id);
  }
  redirect(`/orders/${id}`);
}

export async function mockCancel(form: FormData) {
  await cancelPendingOrder(String(form.get("orderId")));
  redirect("/cart?payment=cancelled");
}
