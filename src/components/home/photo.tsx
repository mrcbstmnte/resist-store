import Image from 'next/image';
import { DyePanel } from '@/components/dye';
import type { HomeImage } from '@/content/home';

/**
 * Fills its (positioned) parent with the photo, or with a drawn print in the
 * fallback colour until a photo is added in src/content/home.ts.
 */
export function PhotoFill({
  photo,
  sizes,
  eager = false,
  printWidth = 600,
  printHeight = 750,
}: {
  photo: HomeImage;
  sizes: string;
  eager?: boolean;
  printWidth?: number;
  printHeight?: number;
}) {
  if (photo.image) {
    return (
      <Image
        src={photo.image}
        alt={photo.alt ?? ''}
        fill
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        className="object-cover"
      />
    );
  }
  return (
    <DyePanel
      color={photo.color}
      seed={photo.seed}
      style="blot"
      width={printWidth}
      height={printHeight}
      className="absolute inset-0 h-full w-full"
    />
  );
}
