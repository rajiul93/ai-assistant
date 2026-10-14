/**
 * The payment failed on SSLCommerz's page. Only shows the Plans page: anyone could post here, so it
 * never changes a payment (a late, valid IPN can still approve it).
 */
export async function POST(request: Request) {
  return Response.redirect(new URL("/billing?payment=failed", request.url), 303);
}
