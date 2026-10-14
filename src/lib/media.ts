import sharp, { type OutputInfo } from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { galleryPhotos, hero, media, products } from '@/db/schema';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;
const MEDIA_PATH = /^\/media\/([0-9a-f-]{36})\.webp$/i;

export class MediaError extends Error {}

/**
 * Normalises an uploaded photo (EXIF rotation, max 1600px, WebP) and stores it.
 * Returns the public path, e.g. /media/<uuid>.webp.
 */
export async function saveUpload(file: File) {
  if (!file.type.startsWith('image/')) throw new MediaError('That file isn’t an image');
  if (file.size > MAX_UPLOAD_BYTES) throw new MediaError('Photo is too large (8MB max)');

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaError('Couldn’t read that image. Try a JPG, PNG or WebP.');
  }

  const [row] = await db
    .insert(media)
    .values({ contentType: 'image/webp', data: out.data, width: out.info.width, height: out.info.height })
    .returning({ id: media.id });
  return `/media/${row.id}.webp`;
}

export async function getMedia(id: string) {
  return db.query.media.findFirst({ where: eq(media.id, id) });
}

const toHex = (n: number) => n.toString(16).padStart(2, '0');

/**
 * The colour around the edges of a photo, as #RRGGBB. Product frames are filled with it,
 * so a photo whose shape doesn't match the frame blends in instead of showing white bars.
 * Uses the median of the outermost pixels, so a product touching one edge doesn't skew it.
 */
export async function edgeColour(image: Buffer) {
  const size = 48;
  const { data } = await sharp(image)
    .flatten({ background: '#ffffff' })
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = [[], [], []] as number[][];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (x > 1 && y > 1 && x < size - 2 && y < size - 2) continue;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  return `#${channels.map((v) => toHex(median(v))).join('')}`.toUpperCase();
}

/** Edge colour of an uploaded photo by its public path, or null for external URLs. */
export async function photoBackground(path: string | null | undefined) {
  const id = path?.match(MEDIA_PATH)?.[1];
  if (!id) return null;
  const row = await getMedia(id);
  return row ? edgeColour(row.data) : null;
}

/**
 * Deletes an uploaded photo by its public path once no product, gallery photo or banner uses it.
 * Ignores external URLs and files under /public.
 */
export async function deleteUpload(path: string | null | undefined) {
  const id = path?.match(MEDIA_PATH)?.[1];
  if (!id) return;
  const users = await Promise.all([
    db.query.products.findFirst({ where: eq(products.imageUrl, path!), columns: { id: true } }),
    db.query.galleryPhotos.findFirst({ where: eq(galleryPhotos.imageUrl, path!), columns: { id: true } }),
    db.query.hero.findFirst({ where: eq(hero.imageUrl, path!), columns: { id: true } }),
  ]);
  if (users.every((u) => !u)) await db.delete(media).where(eq(media.id, id));
}
