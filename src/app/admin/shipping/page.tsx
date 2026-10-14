import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { getStoreSettings } from '@/lib/shipping';
import { ShippingForm } from './shipping-form';

export const metadata: Metadata = { title: 'Shipping' };

export default function ShippingPage() {
  return (
    <>
      <h1 className="display text-5xl">Shipping</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        One flat fee added to every order, shown in the bag and charged with the payment. Changes apply to new orders;
        orders already placed keep the fee they were charged.
      </p>
      <Suspense fallback={<div className="mt-6 h-40 max-w-md animate-pulse rounded bg-thread/50" />}>
        <Current />
      </Suspense>
    </>
  );
}

async function Current() {
  await connection();
  const { shippingFeeCents } = await getStoreSettings();
  return <ShippingForm feePesos={shippingFeeCents / 100} />;
}
