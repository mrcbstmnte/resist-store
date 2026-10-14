import Link from "next/link";
import { Suspense } from "react";
import { cartCount } from "@/lib/cart";
import { Wordmark } from "@/components/logo";
import { SocialLinks } from "@/components/home/social-links";
import { VercelInsights } from "@/components/vercel-insights";

async function BagLink() {
  const n = await cartCount();
  return (
    <Link href="/cart" className="btn-quiet num" aria-label={`Bag, ${n} item${n === 1 ? "" : "s"}`}>
      Bag <span className={n ? "text-accent" : "text-ink-soft"}>{n}</span>
    </Link>
  );
}

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="street flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Resist home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/#shop" className="px-3 py-2 font-bold hover:text-accent">
            Shop
          </Link>
          <Suspense fallback={<span className="btn-quiet">Bag</span>}>
            <BagLink />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">{children}</main>
      <footer className="border-t border-thread">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-end sm:px-6">
          <p className="display text-5xl sm:text-6xl">Your pace, your peace.</p>
          <div className="space-y-4 sm:text-right">
            <SocialLinks />
            <div className="space-y-1 text-sm text-ink-soft">
              <p>Made to move. Built for everyday. Bacolod City.</p>
              <p>Pay with GCash, Maya, QR Ph, or card.</p>
            </div>
          </div>
        </div>
      </footer>
      {/* Storefront only, so admin visits don't count as shopper traffic. */}
      <VercelInsights />
    </div>
  );
}
