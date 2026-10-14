import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, variants } from "@/db/schema";
import { createPendingOrder, markOrderPaid } from "@/lib/inventory";
import { sendOrderConfirmation } from "@/lib/notify";
import { renderOrderConfirmation } from "@/lib/email/order-confirmation";
import { deliverySchema, normalizePhMobile } from "@/lib/address";

const customer = {
  email: "ana@example.com",
  name: "Ana <Reyes>",
  phone: "09171234567",
  addressLine1: "12 Lacson St",
  barangay: "Taculing",
  city: "Bacolod City",
  province: "Negros Occidental",
  postalCode: "6100",
};

const realFetch = globalThis.fetch;
let calls: { url: string; body: Record<string, unknown> }[] = [];
let failNext = false;

beforeEach(async () => {
  await db.execute(sql`TRUNCATE stock_movements, order_items, orders, variants, products RESTART IDENTITY CASCADE`);
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "RESIST <orders@resist.test>";
  calls = [];
  failNext = false;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    if (failNext) {
      failNext = false;
      return new Response("rate limited", { status: 429 });
    }
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

async function paidOrder() {
  const [p] = await db.insert(products).values({ slug: "tee", name: "Active Shirt", priceCents: 89000 }).returning();
  const [v] = await db
    .insert(variants)
    .values({ productId: p.id, sku: "AS-BLU-M", size: "M", stockOnHand: 5 })
    .returning();
  const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 2 }]);
  await markOrderPaid({ orderId: order.id });
  return order;
}

describe("order confirmation email", () => {
  it("sends once even when several paid paths fire", async () => {
    const order = await paidOrder();
    const results = await Promise.all([
      sendOrderConfirmation(order.id),
      sendOrderConfirmation(order.id),
      sendOrderConfirmation(order.id),
    ]);
    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].body).toMatchObject({
      from: "RESIST <orders@resist.test>",
      to: ["ana@example.com"],
      subject: `Order ${order.reference} confirmed`,
    });
  });

  it("does not send for unpaid orders", async () => {
    const [p] = await db.insert(products).values({ slug: "x", name: "X", priceCents: 100 }).returning();
    const [v] = await db.insert(variants).values({ productId: p.id, sku: "X", size: "M", stockOnHand: 1 }).returning();
    const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    expect(await sendOrderConfirmation(order.id)).toBe("skipped");
    expect(calls).toHaveLength(0);
  });

  it("releases the claim when sending fails so a retry can send it", async () => {
    const order = await paidOrder();
    failNext = true;
    expect(await sendOrderConfirmation(order.id)).toBe("failed");
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row.confirmationSentAt).toBeNull();
    expect(await sendOrderConfirmation(order.id)).toBe("sent");
  });

  it("skips quietly when email isn't configured", async () => {
    const order = await paidOrder();
    delete process.env.RESEND_API_KEY;
    expect(await sendOrderConfirmation(order.id)).toBe("skipped");
    expect(calls).toHaveLength(0);
  });

  it("escapes customer-supplied text in the HTML", async () => {
    const order = await paidOrder();
    const full = await db.query.orders.findFirst({ where: eq(orders.id, order.id), with: { items: true } });
    const { html, text } = renderOrderConfirmation(full!, "https://resist.test/orders/1");
    expect(html).toContain("Ana &lt;Reyes&gt;");
    expect(html).not.toContain("<Reyes>");
    expect(html).toContain("Brgy. Taculing");
    expect(text).toContain("Total paid: ₱1,780");
  });
});

describe("delivery address", () => {
  it("normalises PH mobile formats", () => {
    expect(normalizePhMobile("+63 917 123 4567")).toBe("09171234567");
    expect(normalizePhMobile("639171234567")).toBe("09171234567");
    expect(normalizePhMobile("0917-123-4567")).toBe("09171234567");
    expect(normalizePhMobile("034 433 1234")).toBeNull();
  });

  it("requires every address part and a 4-digit postal code", () => {
    expect(deliverySchema.safeParse(customer).success).toBe(true);
    const bad = deliverySchema.safeParse({ ...customer, barangay: "", postalCode: "61000" });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.path[0])).toEqual(["barangay", "postalCode"]);
  });
});
