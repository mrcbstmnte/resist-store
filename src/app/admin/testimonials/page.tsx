import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { listTestimonials } from '@/lib/testimonials';
import { AddTestimonialForm, TestimonialItem } from './testimonial-forms';

export const metadata: Metadata = { title: 'Testimonials' };

export default function TestimonialsPage() {
  return (
    <>
      <h1 className="display text-5xl">Testimonials</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        Reviews shown on the homepage, in this order. The section is hidden until at least one is shown.
      </p>
      <div className="mt-6 max-w-3xl">
        <AddTestimonialForm />
      </div>
      <Suspense fallback={<div className="mt-6 h-72 max-w-3xl animate-pulse rounded bg-thread/50" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await connection();
  const items = await listTestimonials();
  if (items.length === 0) return <p className="mt-8 text-ink-soft">No testimonials yet.</p>;
  return (
    <ul className="mt-6 grid max-w-3xl gap-4">
      {items.map((t, i) => (
        <TestimonialItem key={t.id} t={t} index={i} />
      ))}
    </ul>
  );
}
