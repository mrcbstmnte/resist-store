import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { testimonials } from '@/db/schema';

const order = [asc(testimonials.position), asc(testimonials.id)];

export function listTestimonials() {
  return db.select().from(testimonials).orderBy(...order);
}

export function visibleTestimonials() {
  return db.select().from(testimonials).where(eq(testimonials.visible, true)).orderBy(...order);
}
