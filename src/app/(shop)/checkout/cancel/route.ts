import { NextResponse, type NextRequest } from "next/server";
import { cancelPendingOrder } from "@/lib/inventory";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("order") ?? "";
  if (/^[0-9a-f-]{36}$/i.test(id)) await cancelPendingOrder(id);
  return NextResponse.redirect(new URL("/cart?payment=cancelled", request.url));
}
