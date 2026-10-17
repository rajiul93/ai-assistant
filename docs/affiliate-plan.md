# Affiliate program (owner, 2026-10-17)

An affiliate shares their own link anywhere — Facebook, Messenger, WhatsApp, Telegram, email, SMS,
another site, or pasted by hand. Whoever opens it and then signs up / buys a plan is tied to the
affiliate, and the affiliate earns a commission when that payment is approved. Nothing depends on
where the link was shared.

## Flow

Link → click → visit → sign in → buy → payment approved → commission.

- **Link:** any page with `?ref=CODE` (`/?ref=K7P2QX`; `src/lib/affiliate.ts`). Codes are 6
  characters from an alphabet without 0/O/1/I, made on first need (`ensureAffiliateCode`).
- **Click:** the route guard (`src/proxy.ts` `rememberReferral`) stores `CODE.<time>` in the
  httpOnly `prep_ref` cookie — also on the redirect to /login — and counts the visit once per
  browser per code through `/api/affiliate/click` (public, `event.waitUntil`, so the page isn't
  slowed).
- **Attribution:** `claimReferral` on sign-in (`/api/auth/session`) and again when paying (for
  someone already signed in): within the window, never oneself, first affiliate wins for good, and
  only before the customer's first approved purchase. Stored as `User.referredById`.
- **Commission:** `addCommissionForPayment` inside `approvePayment` (manual review and SSLCommerz
  both go through it), one per payment, from what the customer actually paid.

## Rules — every choice two-way, the super admin picks (`AffiliateSettings`, /admin/affiliates)

| Rule | Options |
|---|---|
| Program | on / off (off: no new commissions, links don't count) |
| Who | only users an admin chose (`User.affiliateActive`) / everyone |
| Commission | percent of the price / fixed taka |
| When | first purchase only / every purchase (renewals too) |
| Window | days after a click (default 30) |
| Payout | cash (admin sends bKash/Nagad, records `AffiliatePayout`) / plan credit (taken off the affiliate's own purchases: `Payment.creditUsedBdt`; a purchase fully covered is approved at once, `payWithCredit`, source `credit`) |

Owed = commissions not voided − cash paid − credit used on non-rejected purchases
(`affiliateBalance`). Staff with Billing choose affiliates, record payouts and void a commission
(after a refund); only the super admin edits the rules.

## Known limits

- Two purchases at the same moment could both use the same credit (no lock); rare, and visible
  on the admin page.
- Click counts aren't protected against someone calling the click endpoint by hand; they are
  informational, money only follows approved payments.
