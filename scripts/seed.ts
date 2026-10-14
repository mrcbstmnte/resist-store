import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";

type Seed = {
  name: string;
  silhouette: "tee" | "hoodie" | "jacket" | "pants" | "shorts" | "cap" | "bag";
  priceCents: number;
  description: string;
  // Each colourway is seeded as its own product: "Name — Colour".
  // Photos are files in scripts/seed-photos/products, uploaded to the media table
  // like admin uploads. Hex tints the drawn fallback if a photo is removed.
  colors: [colour: string, hex: string, photo: string][];
  sizes: string[];
};

// PLACEHOLDER prices and stock (50 per size) — set the real numbers in admin.
const TEE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const catalog: Seed[] = [
  {
    name: "Endurance Division Tee",
    silhouette: "tee",
    priceCents: 89000,
    description: "All-over print tee. RESIST on the chest, Endurance Division runner graphic on the back.",
    colors: [["Black", "#111111", "endurance-division-tee-black.jpg"]],
    sizes: TEE_SIZES,
  },
  {
    name: "Slow Pace Club Tee",
    silhouette: "tee",
    priceCents: 89000,
    description: "All-over print tee. RESIST slowpaceclub on the chest, \u201cYour daily dose of chaos\u201d graphic on the back.",
    colors: [
      ["Grey", "#B9B9B9", "slow-pace-club-tee-grey.jpg"],
      ["Blue", "#1F5FA8", "slow-pace-club-tee-blue.jpg"],
    ],
    sizes: TEE_SIZES,
  },
  {
    name: "5-Panel Cap",
    silhouette: "cap",
    priceCents: 65000,
    description: "Five-panel cap with a contrast brim and RESIST across the front.",
    colors: [
      ["Purple", "#6E1A4F", "five-panel-cap-purple.jpg"],
      ["Green", "#1F6F78", "five-panel-cap-green.jpg"],
      ["Olive Green", "#6B5A2E", "five-panel-cap-olive-green.jpg"],
    ],
    sizes: ["OS"],
  },
  {
    name: "Tote Bag",
    silhouette: "bag",
    priceCents: 45000,
    description: "Tote bag with the RESIST wordmark across the front.",
    colors: [
      ["Green", "#1E4A34", "tote-bag-green.jpg"],
      ["Blue", "#5FB3E3", "tote-bag-blue.jpg"],
    ],
    sizes: ["OS"],
  },
];

const OPENING_STOCK = 50;

// Homepage gallery: [file in scripts/seed-photos/gallery, description].
const galleryPhotos: [string, string][] = [
  ["01-stadium.jpg", "Black-and-white shots of runners in RESIST tees and caps at the stadium, and a pink all-over print tee"],
  ["02-caps-sky.jpg", "RESIST caps held up against a bright blue sky"],
  ["03-road-and-trail.jpg", "Runners in RESIST tees on the road, and on a trail at dusk"],
  ["04-race-day.jpg", "Runners in RESIST tees during a road race, and three of them together after the finish"],
  ["05-pickleball.jpg", "Players in blue RESIST tees on a pickleball court"],
  ["06-caps-and-tees.jpg", "RESIST caps and all-over print tees at the track and outdoors"],
];

const PHOTOS_DIR = path.join(import.meta.dirname, "seed-photos");

async function photoFile(folder: string, name: string) {
  const data = await readFile(path.join(PHOTOS_DIR, folder, name));
  return new File([new Uint8Array(data)], name, { type: "image/jpeg" });
}

async function main() {
  const { db } = await import("../src/db");
  const { products, variants, stockMovements, galleryPhotos: gallery } = await import("../src/db/schema");
  const { slugify } = await import("../src/lib/format");
  const { photoBackground, saveUpload } = await import("../src/lib/media");

  const reset = process.argv.includes("--reset");
  if (reset) {
    await db.execute(
      sql`TRUNCATE stock_movements, order_items, orders, variants, products, gallery_photos, testimonials, hero, media RESTART IDENTITY CASCADE`,
    );
  } else {
    const [{ count }] = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM products`);
    if (count > 0) {
      console.log("Products already exist — skipping seed (use --reset to wipe and reseed).");
      process.exit(0);
    }
  }

  let count = 0;
  for (const p of catalog) {
    for (const [color, hex, photo] of p.colors) {
      const name = `${p.name} — ${color}`;
      const imageUrl = await saveUpload(await photoFile("products", photo));
      const [product] = await db
        .insert(products)
        .values({
          slug: slugify(name),
          name,
          description: p.description,
          priceCents: p.priceCents,
          silhouette: p.silhouette,
          colorHex: hex,
          imageUrl,
          imageBg: await photoBackground(imageUrl),
        })
        .returning();
      count++;
      for (const [pos, size] of p.sizes.entries()) {
        const stock = OPENING_STOCK;
        const [v] = await db
          .insert(variants)
          .values({
            productId: product.id,
            sku: `${slugify(p.name).toUpperCase().replace(/-/g, "").slice(0, 8)}-${slugify(color).toUpperCase().replace(/-/g, "").slice(0, 5)}-${size}`,
            size,
            position: pos,
            stockOnHand: stock,
          })
          .returning();
        if (stock > 0) {
          await db.insert(stockMovements).values({
            variantId: v.id,
            delta: stock,
            balanceAfter: stock,
            reason: "initial",
            note: "Opening stock",
          });
        }
      }
    }
  }
  for (const [position, [file, alt]] of galleryPhotos.entries()) {
    await db.insert(gallery).values({ imageUrl: await saveUpload(await photoFile("gallery", file)), alt, position });
  }
  console.log(`Seeded ${count} products and ${galleryPhotos.length} gallery photos.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
