import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { hero, type Hero } from '@/db/schema';

/** Shown until the banner is edited, or if its row is ever missing. */
export const DEFAULT_HERO: Omit<Hero, 'updatedAt'> = {
  id: 1,
  headline: 'Faster than my excuses.',
  subhead: 'Active wear from Bacolod. Light, quick-dry, and printed edge to edge.',
  ctaLabel: 'Shop the drop',
  ctaHref: '#shop',
  imageUrl: null,
  alt: '',
};

export async function getHero() {
  const row = await db.query.hero.findFirst({ where: eq(hero.id, 1) });
  return row ?? DEFAULT_HERO;
}
