import { markOrderPaid } from "@/lib/inventory";
import { verifyWebhookSignature } from "@/lib/paymongo";
import { sendOrderConfirmation } from "@/lib/notify";

// PayMongo → POST here. Register the URL in the PayMongo dashboard (or via the
// Webhooks API) for the `checkout_session.payment.paid` event.
export async function POST(request: Request) {
  const raw = await request.text();
  let event: {
    data?: {
      attributes?: {
        type?: string;
        livemode?: boolean;
        data?: { id?: string; attributes?: { reference_number?: string } };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const attrs = event.data?.attributes;
  const ok = verifyWebhookSignature(
    raw,
    request.headers.get("paymongo-signature"),
    process.env.PAYMONGO_WEBHOOK_SECRET ?? "",
    { livemode: Boolean(attrs?.livemode) },
  );
  if (!ok) return new Response("Invalid signature", { status: 401 });

  if (attrs?.type !== "checkout_session.payment.paid") {
    return Response.json({ ignored: attrs?.type ?? null });
  }

  const session = attrs.data;
  let result = await markOrderPaid({ checkoutSessionId: session?.id });
  if (!result.ok && session?.attributes?.reference_number) {
    result = await markOrderPaid({ reference: session.attributes.reference_number });
  }
  if (!result.ok) {
    console.error("[paymongo] paid event for unknown checkout session", session?.id);
    // 200 so PayMongo doesn't retry forever for a session that isn't ours.
    return Response.json({ received: true, matched: false });
  }
  if ("oversold" in result && result.oversold) {
    console.warn("[paymongo] order paid after reservation lapsed — oversold", result.orderId);
  }
  // Idempotent: only the first successful send goes out, retries fill in failures.
  await sendOrderConfirmation(result.orderId);
  return Response.json({ received: true, orderId: result.orderId });
}
