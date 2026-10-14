import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { recentMovements } from "@/lib/admin-data";
import { dateTime } from "@/lib/format";
import { WEBSITE } from "@/lib/sales";

export const metadata: Metadata = { title: "Stock history" };

const REASON: Record<string, string> = {
  initial: "Opening stock",
  restock: "Received",
  sale: "Sold",
  adjustment: "Adjusted",
};

export default function MovementsPage() {
  return (
    <>
      <h1 className="display text-5xl">Stock history</h1>
      <p className="mt-2 text-sm text-ink-soft">Every change to on-hand stock, newest first. Holds aren&apos;t listed here because they never change what&apos;s on the shelf.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded bg-thread/50" />}>
        <Movements />
      </Suspense>
    </>
  );
}

async function Movements() {
  await connection(); // always read live stock, never at build time
  const list = await recentMovements();
  if (list.length === 0) return <p className="mt-8 text-ink-soft">No stock changes recorded yet.</p>;
  return (
    <div className="mt-6 overflow-x-auto rounded-md border border-thread bg-paper">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs text-ink-soft">
          <tr className="border-b border-thread">
            <th className="px-4 py-2 font-semibold">When</th>
            <th className="px-3 py-2 font-semibold">Variant</th>
            <th className="px-3 py-2 font-semibold">Change</th>
            <th className="px-3 py-2 text-right font-semibold">Units</th>
            <th className="px-3 py-2 text-right font-semibold">On hand after</th>
            <th className="px-4 py-2 font-semibold">Order or note</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id} className="border-t border-thread/60">
              <td className="num px-4 py-2 text-ink-soft">{dateTime(m.createdAt)}</td>
              <td className="px-3 py-2">
                {m.variant.product.name} <span className="text-ink-soft">(size {m.variant.size})</span>
              </td>
              <td className="px-3 py-2">{REASON[m.reason]}</td>
              <td className={`num px-3 py-2 text-right font-semibold ${m.delta < 0 ? "text-out" : "text-ok"}`}>
                {m.delta > 0 ? `+${m.delta}` : m.delta}
              </td>
              <td className={`num px-3 py-2 text-right ${m.balanceAfter < 0 ? "font-semibold text-out" : ""}`}>{m.balanceAfter}</td>
              <td className="px-4 py-2 text-ink-soft">
                {m.order ? (
                  <>
                    <Link href={`/admin/orders/${m.order.id}`} className="num underline underline-offset-2">
                      {m.order.reference}
                    </Link>{" "}
                    · {m.order.channel?.name ?? WEBSITE}
                    {m.order.recordedBy && ` · by ${m.order.recordedBy}`}
                  </>
                ) : (
                  m.note
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
