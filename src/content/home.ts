/**
 * Homepage content that isn't managed in admin: section headings and social links.
 * The banner, gallery photos and testimonials are edited in /admin.
 */

/** Gallery photos are managed in /admin/gallery; only the heading lives here. */
export const gallery = { title: 'On the move' };

/** Reviews are managed in /admin/testimonials; only the heading lives here. */
export const testimonials = { title: 'Word from the track' };

export const socials = [
  { name: 'Facebook', href: 'https://www.facebook.com/resistbcd', icon: 'facebook' },
  { name: 'Instagram', href: 'https://www.instagram.com/resistbcd/', icon: 'instagram' },
] as const;
