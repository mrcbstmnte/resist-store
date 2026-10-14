import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, storeSettings, variants } from '@/db/schema';
import { createPendingOrder } from '@/lib/inventory';
import { getStoreSettings, shippingFeeFor } from '@/lib/shipping';
import { renderOrderConfirmation } from '@/lib/email/order-confirmation';

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

const setFee = (cents: number) => db.update(storeSettings).set({ shippingFeeCents: cents });

async function orderOfTwoTees() {
  const [p] = await db.insert(products).values({ slug: 'tee', name: 'Tee', priceCents: 89000 }).returning();
  const [v] = await db.insert(variants).values({ productId: p.id, sku: 'TEE-M', size: 'M', stockOnHand: 5 }).returning();
  return createPendingOrder(customer, [{ variantId: v.id, quantity: 2 }]);
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE stock_movements, order_items, orders, variants, products RESTART IDENTITY CASCADE`);
});
afterEach(() => setFee(0));

describe('shipping fee', () => {
  it('starts free', async () => {
    expect(await getStoreSettings()).toMatchObject({ shippingFeeCents: 0 });
    expect(await shippingFeeFor()).toBe(0);
  });

  it('is one flat fee wherever the order goes, for now', async () => {
    await setFee(12000);
    expect(await shippingFeeFor({ city: 'Bacolod City', province: 'Negros Occidental' })).toBe(12000);
    expect(await shippingFeeFor({ city: 'Quezon City', province: 'Metro Manila' })).toBe(12000);
  });

  it('is added to the order total and kept on the order', async () => {
    await setFee(12000);
    const { order } = await orderOfTwoTees();
    expect(order).toMatchObject({ shippingCents: 12000, totalCents: 2 * 89000 + 12000 });
  });

  it('does not change orders already placed', async () => {
    await setFee(12000);
    const { order } = await orderOfTwoTees();
    await setFee(20000);
    const row = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) });
    expect(row).toMatchObject({ shippingCents: 12000, totalCents: 190000 });
  });

  it('rejects a negative fee in the database', async () => {
    await expect(setFee(-1)).rejects.toThrow();
  });

  it('shows on the confirmation email', async () => {
    await setFee(12000);
    const { order, items } = await orderOfTwoTees();
    const { text, html } = renderOrderConfirmation({ ...order, items }, 'https://shop.test/orders/1');
    expect(text).toContain('Shipping: ₱120');
    expect(html).toContain('Shipping');
  });
});

describe('PayMongo checkout with shipping', () => {
  async function linesSent(shippingCents: number) {
    const { createCheckoutSession } = await import('@/lib/paymongo');
    vi.stubEnv('PAYMONGO_SECRET_KEY', 'sk_test_abc');
    let body: { data: { attributes: { line_items: unknown[] } } } | undefined;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ data: { id: 'cs_1', attributes: { checkout_url: 'https://pm.test/cs_1' } } }));
    }) as typeof fetch;
    try {
      await createCheckoutSession({
        reference: 'RST-1',
        customer: { name: 'Ana', email: 'ana@example.com', phone: '' },
        items: [{ productName: 'Tee', variantLabel: 'Size M', unitPriceCents: 89000, quantity: 2 }],
        shippingCents,
        successUrl: 'https://shop.test/ok',
        cancelUrl: 'https://shop.test/cancel',
      });
    } finally {
      globalThis.fetch = realFetch;
      vi.unstubAllEnvs();
    }
    return body!.data.attributes.line_items;
  }

  it('adds shipping as its own line', async () => {
    expect(await linesSent(12000)).toEqual([
      { name: 'Tee — Size M', amount: 89000, currency: 'PHP', quantity: 2 },
      { name: 'Shipping', amount: 12000, currency: 'PHP', quantity: 1 },
    ]);
  });

  it('leaves the line off when shipping is free', async () => {
    expect(await linesSent(0)).toHaveLength(1);
  });
});
