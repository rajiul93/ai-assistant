import { settleByValId } from "@/server/sslcommerz";

/**
 * SSLCommerz's server-to-server notice (IPN). Public (no session — see src/proxy.ts); the payment is
 * approved only after SSLCommerz's validation API confirms the val_id.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const valId = String(form?.get("val_id") ?? "");
  const result = await settleByValId(valId);
  return new Response(result === "invalid" ? "INVALID" : "OK", { status: result === "invalid" ? 400 : 200 });
}
