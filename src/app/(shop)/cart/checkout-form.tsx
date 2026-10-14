"use client";

import { useActionState } from "react";
import { checkout, type FormState } from "@/app/actions";

export function CheckoutForm({
  disabled,
  total,
  mode,
  holdMinutes,
}: {
  disabled: boolean;
  total: string;
  mode: "paymongo" | "mock" | "off";
  holdMinutes: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(checkout, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  // React resets the form after each submit; re-seed it from the echoed values.
  const field = (
    name: string,
    label: React.ReactNode,
    { className: wrap, ...props }: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className={wrap}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={v[name]}
        aria-invalid={err[name] ? true : undefined}
        aria-describedby={err[name] ? `${name}-err` : undefined}
        {...props}
        className={`field ${err[name] ? "!border-out" : ""}`}
      />
      {err[name] && (
        <p id={`${name}-err`} className="mt-1 text-xs font-semibold text-out">
          {err[name]}
        </p>
      )}
    </div>
  );

  return (
    <form action={action} key={JSON.stringify(v)} className="mt-6 space-y-4" noValidate>
      <h2 className="font-bold">Contact</h2>
      {field("name", "Full name", { required: true, autoComplete: "name" })}
      {field("email", "Email", { type: "email", required: true, autoComplete: "email" })}
      {field("phone", <>Mobile <span className="font-normal text-ink-soft">(for the courier)</span></>, {
        type: "tel",
        required: true,
        autoComplete: "tel",
        inputMode: "tel",
        placeholder: "0917 123 4567",
      })}

      <h2 className="pt-2 font-bold">Delivery address</h2>
      {field("addressLine1", "House or unit no., street", {
        required: true,
        autoComplete: "address-line1",
        placeholder: "12 Lacson St, Villa Angela Subd.",
      })}
      {field("barangay", "Barangay", { required: true, autoComplete: "address-line2" })}
      <div className="grid grid-cols-2 gap-3">
        {field("city", "City / municipality", { required: true, autoComplete: "address-level2" })}
        {field("province", "Province", { required: true, autoComplete: "address-level1" })}
      </div>
      {field("postalCode", "Postal code", {
        required: true,
        autoComplete: "postal-code",
        inputMode: "numeric",
        maxLength: 4,
        pattern: "\\d{4}",
        placeholder: "6100",
        className: "max-w-32",
      })}

      {state?.error && (
        <p role="alert" className="rounded-md bg-out-bg px-3 py-2 text-sm font-semibold text-out">
          {state.error}
        </p>
      )}
      <button className="btn num w-full" disabled={disabled || pending}>
        {pending ? "Reserving your items…" : `Pay ${total}`}
      </button>
      <p className="text-xs leading-relaxed text-ink-soft">
        {mode === "off" ? (
          "Online checkout isn't open yet. Please check back soon."
        ) : (
          <>
            {mode === "mock"
              ? "Test mode: you'll see a simulated payment page instead of PayMongo."
              : "You'll pay on PayMongo with GCash, Maya, QR Ph, or card."}{" "}
            Your items are held for {holdMinutes} minutes while you pay.
          </>
        )}
      </p>
    </form>
  );
}
