import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, salesChannels, stockMovements, variants } from '@/db/schema';
import {
  InsufficientStockError,
  SaleInputError,
  createPendingOrder,
  recordOfflineSale,
  stockLevels,
} from '@/lib/inventory';

const customer = {
  email: 'ana@example.com',
  name: 'Ana Reyes',
  phone: '09171234567',
  addressLine1: '12 Lacson St',
  barangay: 'Taculing',
  city: 'Bacolod City',
  province: 'Negros Occidental',
  postalCode: '6100',
};

async function tee(stock: number) {
  const [p] = await db.insert(products).values({ slug: `tee-${Math.random()}`, name: 'Tee', priceCents: 89000 }).returning();
  const [v] = await db.insert(variants).values({ productId: p.id, sku: `TEE-${Math.random()}`, size: 'M', stockOnHand: stock }).returning();
  return v;
}

const channel = async (name: string) => (await db.query.salesChannels.findFirst({ where: eq(salesChannels.name, name) }))!;

beforeEach(async () => {
  await db.execute(sql`TRUNCATE stock_movements, order_items, orders, variants, products RESTART IDENTITY CASCADE`);
});

describe('recordOfflineSale', () => {
  it('starts with the usual channels', async () => {
    const names = (await db.select().from(salesChannels).orderBy(salesChannels.position)).map((c) => c.name);
    expect(names).toEqual(['In person', 'Facebook', 'Instagram', 'Pop-up / event']);
  });

  it('records a paid order on its channel and takes the units off the shelf', async () => {
    const v = await tee(10);
    const fb = await channel('Facebook');
    const { order, overHeld } = await recordOfflineSale({
      channelId: fb.id,
      lines: [{ variantId: v.id, quantity: 2 }],
      paymentMethod: 'GCash',
      customerName: 'Ben',
    });
    expect(order).toMatchObject({
      status: 'paid',
      channelId: fb.id,
      paymentMethod: 'GCash',
      name: 'Ben',
      totalCents: 178000,
      discountCents: 0,
    });
    expect(order.reference).toMatch(/^RST-/);
    expect(overHeld).toEqual([]);
    expect((await stockLevels([v.id])).get(v.id)).toMatchObject({ onHand: 8, available: 8 });
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, v.id));
    expect(moves).toEqual([expect.objectContaining({ delta: -2, balanceAfter: 8, reason: 'sale', orderId: order.id, note: 'Facebook' })]);
  });

  it('keeps a discount and shipping separate from the list price', async () => {
    const v = await tee(5);
    const { order } = await recordOfflineSale({
      channelId: (await channel('Instagram')).id,
      lines: [{ variantId: v.id, quantity: 2 }],
      paymentMethod: 'Bank transfer',
      shippingCents: 12000,
      amountCents: 170000,
    });
    // 2 × ₱890 + ₱120 shipping = ₱1,900 list; paid ₱1,700 → ₱200 off.
    expect(order).toMatchObject({ shippingCents: 12000, totalCents: 170000, discountCents: 20000 });
  });

  it('names an unnamed buyer "Walk-in customer" and backdates when told', async () => {
    const v = await tee(5);
    const soldAt = new Date('2026-10-01T10:00:00+08:00');
    const { order } = await recordOfflineSale({
      channelId: (await channel('In person')).id,
      lines: [{ variantId: v.id, quantity: 1 }],
      paymentMethod: 'Cash',
      soldAt,
    });
    expect(order.name).toBe('Walk-in customer');
    expect(order.paidAt).toEqual(soldAt);
  });

  it('refuses to sell more than is on hand, and changes nothing', async () => {
    const v = await tee(1);
    const err = await recordOfflineSale({
      channelId: (await channel('In person')).id,
      lines: [{ variantId: v.id, quantity: 2 }],
      paymentMethod: 'Cash',
    }).catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(err.shortages).toEqual([{ variantId: v.id, requested: 2, available: 1 }]);
    expect((await stockLevels([v.id])).get(v.id)?.onHand).toBe(1);
    expect(await db.$count(stockMovements)).toBe(0);
  });

  it('can sell a unit a website checkout is holding, and says so', async () => {
    const v = await tee(1);
    await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    const { overHeld } = await recordOfflineSale({
      channelId: (await channel('Pop-up / event')).id,
      lines: [{ variantId: v.id, quantity: 1 }],
      paymentMethod: 'Cash',
    });
    expect(overHeld).toEqual(['Tee (Size M)']);
    expect((await stockLevels([v.id])).get(v.id)).toMatchObject({ onHand: 0, reserved: 1, available: 0 });
  });

  it('rejects bad input', async () => {
    const v = await tee(5);
    const base = { channelId: (await channel('In person')).id, paymentMethod: 'Cash' };
    await expect(recordOfflineSale({ ...base, lines: [] })).rejects.toBeInstanceOf(SaleInputError);
    await expect(recordOfflineSale({ ...base, lines: [{ variantId: v.id, quantity: 0 }] })).rejects.toBeInstanceOf(SaleInputError);
    await expect(
      recordOfflineSale({ ...base, lines: [{ variantId: v.id, quantity: 1 }], amountCents: 100000 }),
    ).rejects.toThrow(/more than/);
    await expect(recordOfflineSale({ ...base, channelId: 9999, lines: [{ variantId: v.id, quantity: 1 }] })).rejects.toBeInstanceOf(
      SaleInputError,
    );
    expect((await stockLevels([v.id])).get(v.id)?.onHand).toBe(5);
  });
});

describe('salesByChannel', () => {
  it('totals paid orders, units and pesos per channel, website first', async () => {
    const { salesByChannel } = await import('@/lib/sales');
    const { markOrderPaid } = await import('@/lib/inventory');
    const v = await tee(20);
    const { order: web } = await createPendingOrder(customer, [{ variantId: v.id, quantity: 1 }]);
    await markOrderPaid({ orderId: web.id });
    await createPendingOrder(customer, [{ variantId: v.id, quantity: 4 }]); // unpaid: not counted
    const fb = await channel('Facebook');
    await recordOfflineSale({ channelId: fb.id, lines: [{ variantId: v.id, quantity: 2 }], paymentMethod: 'GCash' });
    await recordOfflineSale({ channelId: fb.id, lines: [{ variantId: v.id, quantity: 1 }], paymentMethod: 'Cash', amountCents: 80000 });
    // Older than the window: not counted.
    await recordOfflineSale({
      channelId: (await channel('In person')).id,
      lines: [{ variantId: v.id, quantity: 1 }],
      paymentMethod: 'Cash',
      soldAt: new Date(Date.now() - 40 * 86400000),
    });

    expect(await salesByChannel(30)).toEqual([
      { channelId: null, name: 'Website', orders: 1, units: 1, revenueCents: 89000 },
      { channelId: fb.id, name: 'Facebook', orders: 2, units: 3, revenueCents: 178000 + 80000 },
    ]);
  });
});
