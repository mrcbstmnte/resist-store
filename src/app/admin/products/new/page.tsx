import Link from "next/link";
import type { Metadata } from "next";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

export default function NewProduct() {
  return (
    <>
      <Link href="/admin/products" className="text-sm font-semibold text-ink-soft hover:text-ink">
        All products
      </Link>
      <h1 className="display mb-8 mt-2 text-5xl">New product</h1>
      <ProductForm />
    </>
  );
}
