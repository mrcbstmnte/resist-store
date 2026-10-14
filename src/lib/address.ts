import { z } from "zod";

/** Normalises PH mobile numbers to 09XXXXXXXXX; accepts +63, 63, spaces and dashes. */
export function normalizePhMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  const m = digits.match(/^(?:\+?63|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

export const deliverySchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .transform((s, ctx) => {
      const n = normalizePhMobile(s);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a PH mobile number, like 0917 123 4567" });
        return z.NEVER;
      }
      return n;
    }),
  addressLine1: z.string().trim().min(5, "Enter your house or unit number and street").max(200),
  barangay: z.string().trim().min(2, "Enter your barangay").max(100),
  city: z.string().trim().min(2, "Enter your city or municipality").max(100),
  province: z.string().trim().min(2, "Enter your province").max(100),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Postal code is 4 digits"),
});

export type Delivery = z.infer<typeof deliverySchema>;

type AddressLike = Pick<Delivery, "addressLine1" | "barangay" | "city" | "province" | "postalCode">;

/** Lines for display, skipping blanks (orders placed before the split only have line 1). */
export function addressLines(a: AddressLike): string[] {
  return [
    a.addressLine1,
    a.barangay && `Brgy. ${a.barangay.replace(/^(brgy\.?|barangay)\s+/i, "")}`,
    [a.city, a.province].filter(Boolean).join(", "),
    a.postalCode,
  ].filter(Boolean) as string[];
}
