import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { getHero } from '@/lib/hero';
import { HeroForm } from './hero-form';

export const metadata: Metadata = { title: 'Banner' };

export default function HeroPage() {
  return (
    <>
      <h1 className="display text-5xl">Banner</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        The big banner at the top of the homepage. Without a photo it shows the blue drawn print.
      </p>
      <Suspense fallback={<div className="mt-6 h-[36rem] max-w-3xl animate-pulse rounded bg-thread/50" />}>
        <Current />
      </Suspense>
    </>
  );
}

async function Current() {
  await connection();
  const { headline, subhead, ctaLabel, ctaHref, imageUrl, alt } = await getHero();
  return <HeroForm hero={{ headline, subhead, ctaLabel, ctaHref, imageUrl, alt }} />;
}
