/**
 * Homepage content. Edit this file to change the banner, section headings and
 * social links. Gallery photos and testimonials are managed in admin.
 *
 * Banner image: drop a file in /public (e.g. /public/home/banner.jpg) and
 * reference it as '/home/banner.jpg'. Without one, the banner shows a drawn
 * all-over print in `color`.
 */

export type HomeImage = {
  /** Path under /public, e.g. '/home/banner.jpg'. */
  image?: string;
  /** Describe the photo for screen readers. Required once `image` is set. */
  alt?: string;
  /** Fallback print colour while there's no photo. */
  color: string;
  seed: number;
};

export const hero: HomeImage & {
  headline: string;
  subhead: string;
  cta: { label: string; href: string };
} = {
  image: undefined,
  alt: '',
  color: '#2340F0',
  seed: 7,
  headline: 'Faster than my excuses.',
  subhead: 'Active wear from Bacolod. Light, quick-dry, and printed edge to edge.',
  cta: { label: 'Shop the drop', href: '#shop' },
};

/** Gallery photos are managed in /admin/gallery; only the heading lives here. */
export const gallery = { title: 'On the move' };

/** Reviews are managed in /admin/testimonials; only the heading lives here. */
export const testimonials = { title: 'Word from the track' };

export const socials = [
  { name: 'Facebook', href: 'https://www.facebook.com/resistbcd', icon: 'facebook' },
  { name: 'Instagram', href: 'https://www.instagram.com/resistbcd/', icon: 'instagram' },
] as const;
