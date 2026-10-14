/**
 * The RESIST mark (public/brand/logo.png). Drawn as a CSS mask so it takes the
 * current text colour: white on the storefront, black in admin.
 * The mark already spells "resist", so it doubles as the wordmark.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="RESIST"
      className={`inline-block bg-current [mask:url(/brand/logo.png)_center/contain_no-repeat] ${className}`}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <LogoMark className={`h-12 w-12 ${className}`} />;
}
