# Subscription system — plan and decisions

The owner's spec (2026-10-14) asks for: **price = System + AI tier + exam**, an "All exams" plan with
a discount on the exam part only, everything editable by the super admin, a mobile app on the same
API, and hardening (audit log, role protection, MFA, rate limits). This file records how it maps onto
the existing app and what was decided.

## Phases

1. **Pricing (this phase)** — new price model, Plans page, super-admin pricing panel, AI quotas per
   tier, access to question-bank content per exam, SSLCommerz next to the manual bKash/Nagad flow.
2. **Security** — append-only audit log (DB trigger blocks UPDATE/DELETE), DB trigger against role
   changes, `.strict()` input schemas, TOTP MFA + recent re-auth for super-admin actions, rate limits,
   CSP/security headers, alerts on admin login and role changes.
3. **Mobile API** — Bearer auth with the Firebase ID token (the device SDK keeps and rotates the
   refresh token in Keychain/Keystore), REST routes for what the app uses (server actions are
   web-only), Firebase App Check (Play Integrity / App Attest), device list. Admin APIs refuse
   Bearer tokens. In-app sale of digital subscriptions: check Play/App Store billing policy first.

## Decisions (owner, 2026-10-14)

- **"Subject" in the spec = an exam track** (`ExamTrack`: BCS, প্রাইমারি, ১১–২০ গ্রেড to start;
  admin adds more, e.g. Bank Job, NTRCA). Named "পরীক্ষা" in the UI because the app already has
  study `Subject`s. A track links to question-bank content through `bankExam` (the `BankExam` enum);
  a new exam's questions need that enum extended when its sheet is uploaded.
- **Several durations** (`PlanDuration`): admin sets days, label and a discount % for longer ones.
  All other prices are **per 30 days**; a duration's price = monthly total × days/30 × (1 − its
  discount), rounded to the taka.
- **Payment: both.** Manual bKash/Nagad Send Money + admin approval stays the default. SSLCommerz is
  built in but off until its env vars are set and the super admin turns it on.

## Price model (`src/lib/pricing.ts`, pure and unit-tested)

```
one exam : System + Tier + exam price
all exams: System + Tier + (sum of active exams − round(sum × discount%))
then     : × days/30 × (1 − duration discount%), rounded
```

The client sends only `{ tier, exam id | "all", duration id, method }`; the server loads the
catalog and computes the amount. The price breakdown is kept on the `Payment` (`breakdown` JSON)
next to the existing `amountBdt` snapshot, so later price changes never touch old records.

## What a subscription gives

- **System** (any running subscription): the existing premium features — solutions/explanations in
  the user's own sets, unlimited videos.
- **AI tier**: Student or Professional. Quotas are per day by kind — `message` (assistant), `scan`
  (reading photos/PDFs), `suggestion` (spellcheck, parsing, note writing) — plus a token cap per 30
  days as a cost guard. Quotas are read **live** from `AiTier` (the admin can tune them); the token
  cap is copied onto each payment as before. With several running subscriptions the highest tier
  counts.
- **Exams**: question-bank solutions/explanations and "send to Preliminary" for those exams only.
  "All exams" covers the exams active **at purchase** (stored as `trackIds`).

Subscriptions bought at different times run side by side (each from its approval); buying while
one runs still adds tokens to the shared AI allowance as before.

**Old purchases** (before this change) keep full access until they end: their `Entitlement` rows
get `allTracks = true` with no `trackIds`, which means "every exam".

## Data model (migration `…_pricing`)

- `PricingSettings` (one row): `systemPriceBdt`, `allTracksDiscountPct`, `gatewayEnabled`.
- `AiTier` (one per `PlanType`): name, `priceBdt`, `tokensPerMonth`, `messagesPerDay`,
  `scansPerDay`, `suggestionsPerDay`, `active`.
- `ExamTrack`: name, `priceBdt`, `bankExam?` (unique), `active`, `sortOrder`.
- `PlanDuration`: `days`, `label`, `discountPct`, `active`, `sortOrder`.
- `Payment` + `trackIds`, `allTracks`, `breakdown`; `PaymentMethod` + `SSLCOMMERZ`.
- `Entitlement` + `trackIds`, `allTracks`.
- `AiUse` (`userId`, `kind`, `createdAt`): one row per allowed AI action, counted per day.

Defaults seeded by the migration: System ৳100, Student ৳200 (300k tokens; 30 messages, 10 scans,
20 suggestions a day), Professional ৳600 (3M tokens; 150 / 50 / 100), exams ৳150 each, discount
20%, durations 30 days (0%), 90 days (10%), 180 days (15%). `PlanPackage` stays only for history.

## Who edits what

Pricing (settings, tiers, exams, durations, gateway switch): **super admin only**. Approving manual
payments: admins, as before.

## SSLCommerz

Env: `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX` (`true` for the
sandbox), and `APP_URL` (e.g. `https://prep.example.com`; without it the request's host is used).
In the SSLCommerz merchant panel set the IPN URL to `<APP_URL>/api/payments/sslcommerz/ipn`.
Sandbox credentials: register at developer.sslcommerz.com. Flow: the server creates a PENDING payment with its own `tran_id`, opens a session and
redirects to `GatewayPageURL`. The IPN (`/api/payments/sslcommerz/ipn`) and the browser's return
(`/success`) both validate `val_id` with SSLCommerz's validation API and check `tran_id`, amount and
currency before approving; approval only moves a PENDING payment, so a repeat is harmless. These
routes are public in `src/proxy.ts` (SSLCommerz posts without our cookies).

## Where it lives

`src/lib/pricing.ts` (+ test), `src/server/pricing.ts` (catalog, quotes, exam access, running tier),
`src/server/sslcommerz.ts`, `src/app/api/payments/sslcommerz/*`, `src/server/actions/billing.ts`
(overview, manual payment, online payment), `src/server/actions/pricing.ts` (super-admin edits),
`src/server/ai-access.ts` (`checkAi(user, kind, ref)`), `src/components/billing/plan-shop.tsx`,
`src/components/admin/pricing-panel.tsx`.

## Status

- [x] Phase 1 built; migration `20261021000000_pricing` applied to Neon 2026-10-14
- [ ] Phase 1 checks: Plans page and admin pricing panel by hand (signed in), a manual payment end to end, SSLCommerz with sandbox credentials
- [ ] Phase 2
- [ ] Phase 3
