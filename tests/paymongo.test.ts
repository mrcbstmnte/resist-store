import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { paymentMode, verifyWebhookSignature } from "@/lib/paymongo";

const secret = "whsk_test";
const body = JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid" } } });
const t = 1_760_000_000;
const sig = (s: string) => createHmac("sha256", s).update(`${t}.${body}`).digest("hex");
const now = t * 1000;

describe("verifyWebhookSignature", () => {
  it("accepts a valid test-mode signature", () => {
    const header = `t=${t},te=${sig(secret)},li=`;
    expect(verifyWebhookSignature(body, header, secret, { livemode: false, now })).toBe(true);
  });

  it("checks the live field for live events", () => {
    const header = `t=${t},te=${sig(secret)},li=`;
    expect(verifyWebhookSignature(body, header, secret, { livemode: true, now })).toBe(false);
    const live = `t=${t},te=,li=${sig(secret)}`;
    expect(verifyWebhookSignature(body, live, secret, { livemode: true, now })).toBe(true);
  });

  it("rejects a tampered body, wrong secret, or stale timestamp", () => {
    const header = `t=${t},te=${sig(secret)},li=`;
    expect(verifyWebhookSignature(body + " ", header, secret, { livemode: false, now })).toBe(false);
    expect(verifyWebhookSignature(body, `t=${t},te=${sig("nope")},li=`, secret, { livemode: false, now })).toBe(false);
    expect(verifyWebhookSignature(body, header, secret, { livemode: false, now: now + 3600_000 })).toBe(false);
    expect(verifyWebhookSignature(body, null, secret, { livemode: false, now })).toBe(false);
  });
});

describe("createCheckoutSession", () => {
  it("sends a well-formed Checkout Session request and returns the hosted URL", async () => {
    const { createCheckoutSession } = await import("@/lib/paymongo");
    process.env.PAYMONGO_SECRET_KEY = "sk_test_abc";
    let sent: { url: string; init: RequestInit } | undefined;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(
        JSON.stringify({ data: { id: "cs_123", attributes: { checkout_url: "https://checkout.paymongo.com/cs_123" } } }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const res = await createCheckoutSession({
        reference: "TL-ABC123",
        customer: { name: "Ana", email: "ana@example.com", phone: "" },
        items: [{ productName: "Tee", variantLabel: "Ink / M", unitPriceCents: 89000, quantity: 2 }],
        successUrl: "https://shop.test/checkout/success?order=1",
        cancelUrl: "https://shop.test/checkout/cancel?order=1",
      });
      expect(res).toEqual({ id: "cs_123", url: "https://checkout.paymongo.com/cs_123" });
      expect(sent!.url).toBe("https://api.paymongo.com/v1/checkout_sessions");
      expect((sent!.init.headers as Record<string, string>).Authorization).toBe(
        "Basic " + Buffer.from("sk_test_abc:").toString("base64"),
      );
      const attrs = JSON.parse(String(sent!.init.body)).data.attributes;
      expect(attrs.line_items).toEqual([{ name: "Tee — Ink / M", amount: 89000, currency: "PHP", quantity: 2 }]);
      expect(attrs.reference_number).toBe("TL-ABC123");
      expect(attrs.payment_method_types).toContain("gcash");
      expect(attrs.billing).toEqual({ name: "Ana", email: "ana@example.com" });
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.PAYMONGO_SECRET_KEY;
    }
  });
});

describe("paymentMode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses PayMongo whenever a secret key is set", () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_123");
    vi.stubEnv("NODE_ENV", "production");
    expect(paymentMode()).toBe("paymongo");
  });

  it("falls back to the mock page in development", () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(paymentMode()).toBe("mock");
  });

  it("allows the mock page on Vercel previews or when explicitly enabled", () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(paymentMode()).toBe("mock");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_PAYMENTS", "true");
    expect(paymentMode()).toBe("mock");
  });

  it("turns checkout off on a live store without a key", () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_PAYMENTS", "");
    expect(paymentMode()).toBe("off");
  });
});
