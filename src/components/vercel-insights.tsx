'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { maskPrivateIds } from '@/lib/analytics-url';

/** Vercel Web Analytics and Speed Insights for the storefront, with order ids masked. */
export function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: maskPrivateIds(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: maskPrivateIds(event.url) })} />
    </>
  );
}
