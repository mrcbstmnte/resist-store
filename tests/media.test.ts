import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { galleryPhotos, hero, media, products } from '@/db/schema';
import { MediaError, deleteUpload, edgeColour, getMedia, photoBackground, saveUpload } from '@/lib/media';
import { GET } from '@/app/media/[file]/route';

const idOf = (path: string) => path.match(/\/media\/(.+)\.webp$/)![1];

async function png(width: number, height: number) {
  const data = await sharp({ create: { width, height, channels: 3, background: '#2340f0' } }).png().toBuffer();
  return new File([new Uint8Array(data)], 'photo.png', { type: 'image/png' });
}

const serve = (file: string) =>
  GET(new Request(`http://localhost/media/${file}`), { params: Promise.resolve({ file }) });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE media, gallery_photos, stock_movements, order_items, orders, variants, products RESTART IDENTITY CASCADE`);
});

describe('saveUpload', () => {
  it('stores a large photo as WebP, no bigger than 1600px', async () => {
    const path = await saveUpload(await png(3000, 2000));
    expect(path).toMatch(/^\/media\/[0-9a-f-]{36}\.webp$/);
    const row = await getMedia(idOf(path));
    expect(row).toMatchObject({ contentType: 'image/webp', width: 1600, height: 1067 });
    expect((await sharp(row!.data).metadata()).format).toBe('webp');
  });

  it('never enlarges a small photo', async () => {
    const row = await getMedia(idOf(await saveUpload(await png(400, 500))));
    expect(row).toMatchObject({ width: 400, height: 500 });
  });

  it('rejects files that are not images', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await expect(saveUpload(text)).rejects.toBeInstanceOf(MediaError);
  });

  it('rejects an image it cannot decode', async () => {
    const fake = new File(['not really a png'], 'broken.png', { type: 'image/png' });
    await expect(saveUpload(fake)).rejects.toThrow('Couldn’t read that image');
  });
});

describe('deleteUpload', () => {
  it('keeps a photo another product still uses, and deletes it once unused', async () => {
    const path = await saveUpload(await png(100, 100));
    await db.insert(products).values({ slug: 'cap', name: 'Cap', priceCents: 100, imageUrl: path });

    await deleteUpload(path);
    expect(await getMedia(idOf(path))).toBeDefined();

    await db.execute(sql`UPDATE products SET image_url = NULL`);
    await deleteUpload(path);
    expect(await getMedia(idOf(path))).toBeUndefined();
  });

  it('keeps a photo the gallery still uses', async () => {
    const path = await saveUpload(await png(100, 100));
    await db.insert(galleryPhotos).values({ imageUrl: path, alt: 'Runners' });
    await deleteUpload(path);
    expect(await getMedia(idOf(path))).toBeDefined();
  });

  it('keeps a photo the banner still uses', async () => {
    const path = await saveUpload(await png(100, 100));
    await db.update(hero).set({ imageUrl: path });
    await deleteUpload(path);
    expect(await getMedia(idOf(path))).toBeDefined();
    await db.update(hero).set({ imageUrl: null });
  });

  it('ignores links that are not uploads', async () => {
    await saveUpload(await png(100, 100));
    await deleteUpload('/products/tote-bag-blue.jpg');
    await deleteUpload('https://example.com/a.webp');
    expect(await db.$count(media)).toBe(1);
  });
});

describe('GET /media/[file]', () => {
  it('serves an upload with long-lived cache headers', async () => {
    const path = await saveUpload(await png(200, 200));
    const res = await serve(path.slice('/media/'.length));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(200);
  });

  it('404s for unknown or malformed ids', async () => {
    expect((await serve('00000000-0000-0000-0000-000000000000.webp')).status).toBe(404);
    expect((await serve('../../etc/passwd')).status).toBe(404);
  });
});

describe('edgeColour', () => {
  // A grey studio backdrop with a black product filling most of the middle.
  async function productShot(backdrop: string) {
    return sharp({ create: { width: 600, height: 400, channels: 3, background: backdrop } })
      .composite([
        { input: await sharp({ create: { width: 300, height: 300, channels: 3, background: '#000000' } }).png().toBuffer(), top: 50, left: 150 },
      ])
      .png()
      .toBuffer();
  }

  it('reads the backdrop, not the product', async () => {
    expect(await edgeColour(await productShot('#c5c5c5'))).toBe('#C5C5C5');
  });

  it('ignores a product that touches one edge', async () => {
    const shot = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#e0d8c8' } })
      .composite([{ input: await sharp({ create: { width: 400, height: 120, channels: 3, background: '#000' } }).png().toBuffer(), top: 280, left: 0 }])
      .png()
      .toBuffer();
    expect(await edgeColour(shot)).toBe('#E0D8C8');
  });

  it('treats transparency as white', async () => {
    const clear = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    expect(await edgeColour(clear)).toBe('#FFFFFF');
  });
});

describe('photoBackground', () => {
  it('reads the colour of an uploaded photo', async () => {
    // #2340f0, give or take WebP rounding.
    const hex = (await photoBackground(await saveUpload(await png(200, 300))))!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(Math.abs(r - 0x23) + Math.abs(g - 0x40) + Math.abs(b - 0xf0)).toBeLessThanOrEqual(6);
  });

  it('is null for external URLs, missing uploads and no photo', async () => {
    expect(await photoBackground('https://example.com/shirt.jpg')).toBeNull();
    expect(await photoBackground('/media/00000000-0000-0000-0000-000000000000.webp')).toBeNull();
    expect(await photoBackground(null)).toBeNull();
  });
});
