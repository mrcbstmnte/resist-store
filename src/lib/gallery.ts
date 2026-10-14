import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { galleryPhotos } from '@/db/schema';

export function listGallery() {
  return db.select().from(galleryPhotos).orderBy(asc(galleryPhotos.position), asc(galleryPhotos.id));
}
