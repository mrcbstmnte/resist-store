import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.paymongo.com/v1";

/**
 * "paymongo" with a secret key. Without one, the mock payment page (which lets
 * anyone mark an order paid) runs only in development, on Vercel preview
 * deployments, or when ALLOW_MOCK_PAYMENTS=true; a live store is "off".
 */
export function paymentMode(): "paymongo" | "mock" | "off" {
  if (process.env.PAYMONGO_SECRET_KEY) return "paymongo";
  const mockAllowed =
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.ALLOW_MOCK_PAYMENTS === "true";
  return mockAllowed ? "mock" : "off";
}

export const PAYMENT_METHODS = (
  process.env.PAYMONGO_PAYMENT_METHODS ?? "gcash,paymaya,card,qrph,grab_pay"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type CheckoutInput = {
  reference: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    addressLine1?: string;
    barangay?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  items: { productName: string; variantLabel: string; unitPriceCents: number; quantity: number }[];
  /** Added as its own "Shipping" line so PayMongo's total matches the order. */
  shippingCents?: number;
  successUrl: string;
  cancelUrl: string;
};

export async function createCheckoutSession(input: CheckoutInput) {
  const key = process.env.PAYMONGO_SECRET_KEY!;
  const res = await fetch(`${API}/checkout_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(`${key}:`).toString("base64"),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            ...input.items.map((i) => ({
              name: `${i.productName} — ${i.variantLabel}`.slice(0, 255),
              amount: i.unitPriceCents,
              currency: "PHP",
              quantity: i.quantity,
            })),
            // PayMongo rejects zero-amount lines, so free shipping is simply left off.
            ...(input.shippingCents ? [{ name: "Shipping", amount: input.shippingCents, currency: "PHP", quantity: 1 }] : []),
          ],
          payment_method_types: PAYMENT_METHODS,
          reference_number: input.reference,
          description: `Order ${input.reference}`,
          billing: {
            name: input.customer.name,
            email: input.customer.email,
            ...(input.customer.phone ? { phone: input.customer.phone } : {}),
            ...(input.customer.addressLine1
              ? {
                  address: {
                    line1: input.customer.addressLine1,
                    line2: input.customer.barangay,
                    city: input.customer.city,
                    state: input.customer.province,
                    postal_code: input.customer.postalCode,
                    country: "PH",
                  },
                }
              : {}),
          },
          send_email_receipt: true,
          show_line_items: true,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: { reference: input.reference },
        },
      },
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.map((e: { detail?: string }) => e.detail).join("; ");
    throw new Error(`PayMongo checkout failed (${res.status}): ${detail || "unknown error"}`);
  }
  return { id: json.data.id as string, url: json.data.attributes.checkout_url as string };
}

/**
 * Verifies the `Paymongo-Signature` header: `t=<ts>,te=<test sig>,li=<live sig>`.
 * Signature = hex(HMAC-SHA256(secret, `${t}.${rawBody}`)), compared against `li`
 * for live events and `te` for test events.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  opts: { livemode: boolean; toleranceSec?: number; now?: number },
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = parts.t;
  const expected = opts.livemode ? parts.li : parts.te;
  if (!t || !expected) return false;

  const tolerance = opts.toleranceSec ?? 300;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(t)) > tolerance) return false;

  const computed = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Used as a fallback on the success page in case the webhook hasn't arrived yet. */
export async function isCheckoutSessionPaid(sessionId: string): Promise<boolean> {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) return false;
  const res = await fetch(`${API}/checkout_sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(`${key}:`).toString("base64"),
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const json = await res.json();
  const payments: { attributes?: { status?: string } }[] = json?.data?.attributes?.payments ?? [];
  return payments.some((p) => p.attributes?.status === "paid");
}
