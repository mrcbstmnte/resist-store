import { eq } from 'drizzle-orm';
import { db, type DB, type Tx } from '@/db';
import { storeSettings } from '@/db/schema';
import type { Delivery } from './address';

export async function getStoreSettings(conn: DB | Tx = db) {
  const row = await conn.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
  return row ?? { id: 1, shippingFeeCents: 0, updatedAt: new Date(0) };
}

/**
 * Shipping for an order going to `address`, in centavos. One flat fee for now;
 * area-based rates only need to change this function, since checkout, the cart
 * and PayMongo all ask it. `address` is optional for the cart, before it's typed in.
 */
export async function shippingFeeFor(_address?: Pick<Delivery, 'city' | 'province'>, conn: DB | Tx = db) {
  return (await getStoreSettings(conn)).shippingFeeCents;
}
