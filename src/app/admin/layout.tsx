import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminNav } from "./nav";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = {
  title: { default: "Stock", template: "%s | RESIST admin" },
  robots: { index: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-panel">
      <header className="border-b border-thread bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <LogoMark className="h-9 w-9" />
            <span className="text-sm font-semibold text-ink-soft">Admin</span>
          </Link>
          <Suspense fallback={<nav className="h-8 flex-1" />}>
            <AdminNav />
          </Suspense>
          <Link href="/" className="ml-auto text-sm font-semibold text-ink-soft hover:text-ink">
            View store
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
