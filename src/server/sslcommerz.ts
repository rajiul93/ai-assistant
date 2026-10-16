import { prisma } from "@/lib/prisma";
import { approvePayment } from "@/server/billing";
import { userError } from "@/lib/user-error";

/*
 * SSLCommerz online payments (docs/subscription-plan.md). Server-only: the store password never
 * leaves the server. A payment counts only after SSLCommerz's own validation API confirms it, for
 * the same transaction id, amount and currency we created — never on what the browser posts back.
 */

const storeId = () => process.env.SSLCOMMERZ_STORE_ID ?? "";
const storePassword = () => process.env.SSLCOMMERZ_STORE_PASSWORD ?? "";
const baseUrl = () => (process.env.SSLCOMMERZ_SANDBOX === "true" ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");

/** The store's credentials are set on this server. */
export const gatewayConfigured = () => Boolean(storeId() && storePassword());

/** Our transaction id for a new gateway payment: unique and hard to guess. */
export const newTransactionId = () => `PREP${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

/**
 * Opens a payment session and returns the page to send the customer to. `appUrl` is this site's
 * origin; SSLCommerz posts back to its /api/payments/sslcommerz/* routes.
 */
export async function createSession(input: { tranId: string; amount: number; product: string; customer: { name: string; email: string; phone: string }; appUrl: string }) {
  const callback = (path: string) => `${input.appUrl}/api/payments/sslcommerz/${path}`;
  const form = new URLSearchParams({
    store_id: storeId(),
    store_passwd: storePassword(),
    total_amount: input.amount.toFixed(2),
    currency: "BDT",
    tran_id: input.tranId,
    success_url: callback("success"),
    fail_url: callback("fail"),
    cancel_url: callback("cancel"),
    ipn_url: callback("ipn"),
    cus_name: input.customer.name.slice(0, 50) || "Prep user",
    cus_email: input.customer.email,
    cus_phone: input.customer.phone,
    cus_add1: "Bangladesh",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
    product_name: input.product.slice(0, 100),
    product_category: "Education",
    product_profile: "non-physical-goods",
  });
  const response = await fetch(`${baseUrl()}/gwprocess/v4/api.php`, { method: "POST", body: form, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const data = (await response.json().catch(() => null)) as { status?: string; GatewayPageURL?: string; failedreason?: string } | null;
  if (!response.ok || data?.status !== "SUCCESS" || !data.GatewayPageURL) throw userError(`Online payment খোলা গেল না${data?.failedreason ? ` (${data.failedreason})` : ""}। bKash/Nagad দিয়ে চেষ্টা করুন।`);
  return data.GatewayPageURL;
}

type Validation = { status?: string; tran_id?: string; amount?: string; currency?: string; bank_tran_id?: string };

/**
 * Confirms a payment with SSLCommerz by its `val_id` and, if everything matches, approves our
 * pending payment (which only ever moves a PENDING one, so the IPN and the browser's return can
 * both arrive safely). Returns what happened, for the redirect.
 */
export async function settleByValId(valId: string): Promise<"approved" | "already" | "invalid"> {
  if (!gatewayConfigured() || !valId) return "invalid";
  const url = `${baseUrl()}/validator/api/validationserverAPI.php?${new URLSearchParams({ val_id: valId, store_id: storeId(), store_passwd: storePassword(), v: "1", format: "json" })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);
  const data = (await response?.json().catch(() => null)) as Validation | null;
  if (!data || (data.status !== "VALID" && data.status !== "VALIDATED") || !data.tran_id) return "invalid";

  const payment = await prisma.payment.findFirst({ where: { method: "SSLCOMMERZ", transactionId: data.tran_id }, select: { id: true, status: true, amountBdt: true } });
  if (!payment) return "invalid";
  if (payment.status === "APPROVED") return "already";
  if (payment.status !== "PENDING" || data.currency !== "BDT" || Math.round(Number(data.amount)) < payment.amountBdt) return "invalid";
  try {
    await approvePayment(payment.id, "sslcommerz", `val_id ${valId}${data.bank_tran_id ? ` · bank ${data.bank_tran_id}` : ""}`.slice(0, 300));
    return "approved";
  } catch {
    // Approved a moment ago by the other callback.
    return "already";
  }
}
