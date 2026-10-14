import 'dotenv/config';

// Fills products.image_bg for photos uploaded before the column existed.
// Safe to run any time: only touches products with a photo and no colour yet.
async function main() {
  const { and, eq, isNotNull, isNull } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { products } = await import('../src/db/schema');
  const { photoBackground } = await import('../src/lib/media');

  const rows = await db
    .select({ id: products.id, imageUrl: products.imageUrl })
    .from(products)
    .where(and(isNotNull(products.imageUrl), isNull(products.imageBg)));
  let filled = 0;
  for (const row of rows) {
    const imageBg = await photoBackground(row.imageUrl);
    if (!imageBg) continue;
    await db.update(products).set({ imageBg }).where(eq(products.id, row.id));
    filled++;
  }
  console.log(`Photo backgrounds: filled ${filled} of ${rows.length} products.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
