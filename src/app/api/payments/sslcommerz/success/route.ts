import { settleByValId } from "@/server/sslcommerz";

/**
 * The customer's browser comes back here (a POST from SSLCommerz's page, without our cookies).
 * Validate the same way as the IPN — whichever arrives first approves — then show the Plans page.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const result = await settleByValId(String(form?.get("val_id") ?? ""));
  return Response.redirect(new URL(`/billing?payment=${result === "invalid" ? "pending" : "success"}`, request.url), 303);
}
