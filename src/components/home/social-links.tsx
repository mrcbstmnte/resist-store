import type { ReactElement } from 'react';
import { socials } from '@/content/home';

const ICONS: Record<(typeof socials)[number]['icon'], ReactElement> = {
  facebook: (
    <path
      fill="currentColor"
      d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21z"
    />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
};

export function SocialLinks() {
  return (
    <ul className="flex gap-2 sm:justify-end">
      {socials.map((s) => (
        <li key={s.name}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`RESIST on ${s.name}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-thread transition-colors hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              {ICONS[s.icon]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
