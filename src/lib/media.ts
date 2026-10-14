import sharp, { type OutputInfo } from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { galleryPhotos, media, products } from '@/db/schema';

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

/**
 * Deletes an uploaded photo by its public path once no product or gallery photo uses it.
 * Ignores external URLs and files under /public.
 */
export async function deleteUpload(path: string | null | undefined) {
  const id = path?.match(MEDIA_PATH)?.[1];
  if (!id) return;
  const [product, photo] = await Promise.all([
    db.query.products.findFirst({ where: eq(products.imageUrl, path!), columns: { id: true } }),
    db.query.galleryPhotos.findFirst({ where: eq(galleryPhotos.imageUrl, path!), columns: { id: true } }),
  ]);
  if (!product && !photo) await db.delete(media).where(eq(media.id, id));
}
