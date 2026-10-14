/** The customer cancelled on SSLCommerz's page. Like /fail, it changes nothing. */
export async function POST(request: Request) {
  return Response.redirect(new URL("/billing?payment=cancelled", request.url), 303);
}
