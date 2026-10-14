import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, stockMovements, variants } from "@/db/schema";
import {
  adjustStock,
  cancelPendingOrder,
  createPendingOrder,
  InsufficientStockError,
  markOrderPaid,
  stockLevels,
} from "@/lib/inventory";

const customer = {
  email: "a@b.co",
  name: "Ana",
  phone: "09171234567",
  addressLine1: "12 Lacson St",
  barangay: "Taculing",
  city: "Bacolod City",
  province: "Negros Occidental",
  postalCode: "6100",
};

async function makeVariant(stock: number) {
  const [p] = await db
    .insert(products)
    .values({ slug: `p-${Math.random()}`, name: "Tee", priceCents: 50000 })
    .returning();
  const [v] = await db
    .insert(variants)
    .values({ productId: p.id, sku: `SKU-${Math.random()}`, size: "M", stockOnHand: stock })
    .returning();
  return v;
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE stock_movements, order_items, orders, variants, products RESTART IDENTITY CASCADE`);
});

describe("reservations", () => {
  it("holds stock while pending without touching on_hand", async () => {
    const v = await makeVariant(5);
    await createPendingOrder(customer, [{ variantId: v.id, quantity: 2 }]);
    expect((await stockLevels([v.id])).get(v.id)).toEqual({ onHand: 5, reserved: 2, available: 3 });
  });

  it("rejects when requested exceeds available, reporting the shortage", async () => {
    const v = await makeVariant(3);
    await createPendingOrder(customer, [{ variantId: v.id, quantity: 2 }]);
    const err = await createPendingOrder(customer, [{ variantId: v.id, quantity: 2 }]).catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(err.shortages).toEqual([{ variantId: v.id, requested: 2, available: 1 }]);
  });

  it("never oversells the last unit under concurrent checkouts", async () => {
    const v = await makeVariant(1);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }])),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await stockLevels([v.id])).get(v.id)!.available).toBe(0);
  });

  it("releases stock automatically once the reservation expires", async () => {
    const v = await makeVariant(1);
    const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await db.update(orders).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(orders.id, order.id));
    expect((await stockLevels([v.id])).get(v.id)!.available).toBe(1);
  });

  it("releases stock immediately on cancel", async () => {
    const v = await makeVariant(1);
    const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await cancelPendingOrder(order.id);
    expect((await stockLevels([v.id])).get(v.id)!.available).toBe(1);
  });
});

describe("payment", () => {
  it("converts the reservation into a sale exactly once", async () => {
    const v = await makeVariant(4);
    const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 3 }]);
    const first = await markOrderPaid({ orderId: order.id });
    const second = await markOrderPaid({ orderId: order.id });
    expect(first).toMatchObject({ ok: true, alreadyPaid: false, oversold: false });
    expect(second).toMatchObject({ ok: true, alreadyPaid: true });
    expect((await stockLevels([v.id])).get(v.id)).toEqual({ onHand: 1, reserved: 0, available: 1 });
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, v.id));
    expect(moves.map((m) => [m.reason, m.delta, m.balanceAfter])).toEqual([["sale", -3, 1]]);
  });

  it("flags oversold when a lapsed reservation is paid after the stock was resold", async () => {
    const v = await makeVariant(1);
    const { order: late } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await db.update(orders).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(orders.id, late.id));
    const { order: other } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await markOrderPaid({ orderId: other.id });
    const res = await markOrderPaid({ orderId: late.id });
    expect(res).toMatchObject({ ok: true, oversold: true });
    const [row] = await db.select().from(orders).where(eq(orders.id, late.id));
    expect(row.status).toBe("paid");
  });

  it("finds orders by checkout session id", async () => {
    const v = await makeVariant(2);
    const { order } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await db.update(orders).set({ checkoutSessionId: "cs_test_123" }).where(eq(orders.id, order.id));
    expect(await markOrderPaid({ checkoutSessionId: "cs_test_123" })).toMatchObject({ ok: true });
    expect(await markOrderPaid({ checkoutSessionId: "cs_missing" })).toMatchObject({ ok: false });
  });
});

describe("adjustStock", () => {
  it("restocks and records the movement", async () => {
    const v = await makeVariant(2);
    expect(await adjustStock(v.id, 10, "restock", "PO-1")).toBe(12);
  });

  it("refuses to go below zero", async () => {
    const v = await makeVariant(2);
    await expect(adjustStock(v.id, -3, "adjustment")).rejects.toThrow(/Only 2 on hand/);
  });
});
