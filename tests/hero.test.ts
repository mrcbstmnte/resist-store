import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { hero } from '@/db/schema';
import { DEFAULT_HERO, getHero } from '@/lib/hero';

afterAll(async () => {
  await db.execute(sql`DELETE FROM hero`);
  await db.insert(hero).values(DEFAULT_HERO);
});

describe('hero', () => {
  it('starts with the original banner copy from the migration', async () => {
    expect(await getHero()).toMatchObject({ headline: 'Faster than my excuses.', ctaHref: '#shop', imageUrl: null });
  });

  it('only ever holds one row', async () => {
    await expect(db.insert(hero).values({ id: 2, headline: 'Second' })).rejects.toThrow();
  });

  it('falls back to the default copy if the row is missing', async () => {
    await db.execute(sql`DELETE FROM hero`);
    expect(await getHero()).toEqual(DEFAULT_HERO);
  });
});
