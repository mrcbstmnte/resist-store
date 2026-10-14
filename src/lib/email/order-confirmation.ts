import type { Order, OrderItem } from "@/db/schema";
import { addressLines } from "@/lib/address";
import { money } from "@/lib/format";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Order confirmation, as plain table-based HTML with inline styles so it renders
 * in Gmail, Outlook and Apple Mail without a build step.
 */
export function renderOrderConfirmation(order: Order & { items: OrderItem[] }, orderUrl: string) {
  const first = order.name.split(" ")[0] || order.name;
  const subject = `Order ${order.reference} confirmed`;
  const address = [order.name, ...addressLines(order), order.phone].filter(Boolean);

  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4e0;font-size:15px;line-height:1.4;color:#000">
          <strong>${esc(i.productName)}</strong><br>
          <span style="color:#5b5b5b">${esc(i.variantLabel)} &times; ${i.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #e4e4e0;font-size:15px;color:#000;white-space:nowrap">
          ${money(i.unitPriceCents * i.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f2ef;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">Payment received for ${esc(order.reference)}. Packing it now.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2ef">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
        <tr><td style="background:#000;padding:20px 28px">
          <span style="font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:-0.5px;color:#fff;text-transform:uppercase">Resist</span>
        </td></tr>
        <tr><td style="background:#2340f0;padding:28px">
          <p style="margin:0 0 6px;font-size:14px;color:#cdd6ff">Order ${esc(order.reference)}</p>
          <h1 style="margin:0;font-family:'Arial Narrow',Arial,sans-serif;font-size:34px;line-height:1;font-weight:900;color:#fff;text-transform:uppercase">Paid. You're in, ${esc(first)}.</h1>
        </td></tr>
        <tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.55;color:#000">
          We've received your payment and we're packing your order now. It usually ships within 2 to 4 days.
        </td></tr>
        <tr><td style="padding:8px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rows}
            <tr>
              <td style="padding:10px 0 0;font-size:15px;color:#000">Shipping</td>
              <td align="right" style="padding:10px 0 0;font-size:15px;color:#000">${order.shippingCents ? money(order.shippingCents) : "Free"}</td>
            </tr>
            <tr>
              <td style="padding:14px 0 0;font-size:16px;font-weight:bold;color:#000">Total paid</td>
              <td align="right" style="padding:14px 0 0;font-size:16px;font-weight:bold;color:#000">${money(order.totalCents)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 28px 8px">
          <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#5b5b5b">Delivering to</p>
          <p style="margin:0;font-size:15px;line-height:1.5;color:#000">${address.map(esc).join("<br>")}</p>
        </td></tr>
        <tr><td style="padding:24px 28px 32px">
          <a href="${esc(orderUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:999px">View your order</a>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e4e4e0;font-size:12px;line-height:1.5;color:#5b5b5b">
          Questions about your order? Reply to this email.<br>RESIST, Bacolod City
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Order ${order.reference} confirmed`,
    "",
    `Hi ${first}, we've received your payment and we're packing your order now. It usually ships within 2 to 4 days.`,
    "",
    ...order.items.map((i) => `${i.quantity} x ${i.productName} (${i.variantLabel})  ${money(i.unitPriceCents * i.quantity)}`),
    `Shipping: ${order.shippingCents ? money(order.shippingCents) : "Free"}`,
    `Total paid: ${money(order.totalCents)}`,
    "",
    "Delivering to:",
    ...address,
    "",
    `View your order: ${orderUrl}`,
    "",
    "Questions? Reply to this email.",
  ].join("\n");

  return { subject, html, text };
}
