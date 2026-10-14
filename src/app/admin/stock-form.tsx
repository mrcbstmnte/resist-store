"use client";

import { useActionState, useState } from "react";
import { changeStock, type AdminState } from "./actions";

export function StockForm({ variantId, onHand }: { variantId: number; onHand: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(changeStock, null);
  const [mode, setMode] = useState<"add" | "set">("add");
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <select
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as "add" | "set")}
        aria-label="Stock change type"
        className="rounded-md border border-thread bg-paper px-1.5 py-1 text-xs"
      >
        <option value="add">Receive</option>
        <option value="set">Count</option>
      </select>
      <input
        key={`${mode}-${onHand}`}
        name="quantity"
        type="number"
        inputMode="numeric"
        required
        defaultValue={mode === "set" ? onHand : undefined}
        placeholder={mode === "add" ? "+12" : undefined}
        aria-label={mode === "add" ? "Units received (negative to remove)" : "Counted units on hand"}
        className="num w-16 rounded-md border border-thread bg-paper px-2 py-1 text-right text-sm"
      />
      <input type="hidden" name="variantId" value={variantId} />
      <button disabled={pending} className="rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-paper hover:bg-accent disabled:opacity-50">
        {pending ? "…" : "Save"}
      </button>
      <span
        role="status"
        className={`num w-full text-right text-xs ${state?.error ? "text-out" : "text-ok"}`}
      >
        {state?.error ?? state?.ok ?? ""}
      </span>
    </form>
  );
}
