@AGENTS.md

# Prep — project guide (source of truth for AI-assisted work)

A Bangla-first study app for Bangladesh job-exam candidates: tasks and study timer, notes, a
subject/topic tree, MCQ ("Preliminary") and short-question sets with exams, confusions, vocabulary,
a typing lab, job applications, an AI assistant with voice, and paid plans for AI access.

Keep this file accurate. A fresh session must be able to continue from it and the linked docs
alone. Record decisions and their reasons; don't restate code.

## Stack

- **Next.js 16.3.5** App Router, Turbopack. Route guard and session refresh: `src/proxy.ts` (Next 16
  calls middleware "proxy"). This Next has breaking changes: read `node_modules/next/dist/docs/`
  before using unfamiliar APIs (see `AGENTS.md`).
- React 19, TypeScript strict, Tailwind 4, Radix UI (`src/components/ui`), lucide icons, `sonner`
  toasts, `@tanstack/react-query`, zustand (`src/store`).
- **Prisma 6.19 + Neon Postgres** (`prisma/schema.prisma`, client in `src/lib/prisma.ts`).
- **Firebase Auth** (client SDK sign-in; firebase-admin on the server). AI via OpenAI or Google Gemini
  (`src/server/assistant/ai.ts` `callAI`; the super admin picks one on /usage (Gemini default model gemini-3.8-flash; Google closed 2.5 Flash to new keys) — owner, 2026-10-18 — and
  the other, when it has a key, answers if the chosen one fails. The Gemini key is entered there and
  stored AES-encrypted in `AiSettings` (`src/server/secret-box.ts`, secret `AI_SETTINGS_SECRET` or the
  Firebase private key); migration `20261102000000_ai_settings`. Voice and images stay on OpenAI).
- Deployed on **Vercel** (serverless). The production build runs `prisma migrate deploy`.

## Commands

| | |
|---|---|
| `pnpm dev` | dev server on :3000. **The owner usually runs it**; don't start a second one. Logs: `.next/dev/logs/next-development.log` |
| `pnpm typecheck` / `pnpm lint` | must pass before committing |
| `pnpm test` | vitest unit tests (pure logic, no DB) |
| `pnpm test:integration` | server actions end-to-end against the Neon **test branch** in `.env.test` (refuses to run without it, or if it equals `.env`) |
| `pnpm realtime` | the socket.io server (`realtime/server.mts`, :4000) next to `pnpm dev`; optional — see `realtime/README.md` |
| `npx prisma migrate deploy` | apply migrations (see Database rules) |
| `pnpm db:seed-vocabulary [--update]` | load the built-in vocabulary (idempotent) |

## Database rules (important — learned the hard way)

- **Dev and production share one Neon database.** Every DB write from a dev machine hits real data.
  **Ask the owner before any write** (migrations, seeds, scripts).
- **Never** run `prisma migrate dev`, `migrate reset`, `db push --force-reset` or anything using a
  shadow database: it once wiped the Neon DB.
- Migrations are **hand-written, idempotent SQL** (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN
  duplicate_object …`). Generate the SQL offline with
  `prisma migrate diff --from-schema-datamodel <old.prisma> --to-schema-datamodel prisma/schema.prisma --script`
  (old = `git show HEAD:prisma/schema.prisma`), review it, then put it in
  `prisma/migrations/<timestamp>_<name>/migration.sql`. Prefer additive changes.
- After `prisma generate`, the running dev server keeps the **old client** (models missing →
  "Cannot read properties of undefined (reading 'findMany')" or "Unknown field"). **Restart dev.**
- Run migrations over Neon's **direct** host (the URL without `-pooler`): through the pooler,
  Prisma's advisory lock can stay stuck on a pooled connection (P1002, seen 2026-10-15).
- Stop the dev server before `pnpm add`; installing under a running `next dev` breaks pages.
- Integration tests use a **separate Neon branch** in `.env.test` (git-ignored), never `DATABASE_URL`.

## Git

- Work and commit on **`dev`**; the owner merges `dev` → `main` (a PR), or asks for it explicitly.
- Commit messages: conventional (`feat(scope): …`), a body explaining why.

## Conventions

- **Server actions** in `src/server/actions/*.ts` (`"use server"`): `requireUser()` → parse input
  with **zod** → authorization (ownership via `findFirst({ where: { id, userId } })`, roles via
  `src/server/roles.ts`) → Prisma (a `$transaction` when several rows must change together) →
  `revalidatePath`. Throw `userError("…")` (`src/lib/user-error.ts`) with a short Bangla message and
  show it with `errorMessage(error, fallback)` in the toast — **never `new Error` + `error.message`**:
  production hides a thrown message (React #441); `userError` carries it in the error's `digest`,
  which Next passes through. Zod errors whose first message is Bangla get the same digest.
- **Route handlers** (`src/app/api/*`) for AI calls, streams, uploads and polling GETs. They call
  `requireUser()` too and return JSON `{ error }` with a status code on failure.
- Shared server-only helpers in `src/server/*`; pure helpers usable on both sides in `src/lib/*`.
- **Light mode only** (owner's choice, 2026-10-15): no dark palette, `color-scheme: light` in
  `globals.css` and the viewport; don't add `dark:` styles.
- **Easy on the eyes** (owner, 2026-10-15): no pure white or near-black. `globals.css` overrides
  `--color-white` (soft paper `#fdfdfa`), the lightest and darkest zinc/slate shades, and the page
  background is `#f3f3ef`. Tune colours there, not per component.
- Floating UI on phones: one draggable dock (`ToolDock`: AI chat fixed first, then the user's own
  shortcuts — up to 5 tools or pages, `User.quickItems`, picked and drag-ordered on `/settings`,
  `src/lib/quick-items.ts`; owner, 2026-10-18; snaps to the left or right edge, height remembered) and the running study session as a chip in the top
  bar that opens a sheet (`SessionBar variant="chip"`; desktop keeps the bottom bar).
- UI copy is **Bangla** (English for technical terms). Mobile first: no horizontal page scroll; wide
  tables scroll inside their own container.
- Comments explain *why* or a non-obvious rule; JSDoc on exported functions in that style.
- Rich text (notes) is sanitized with `sanitizeNoteHtml` on save; never render user HTML otherwise.
- Math in text is `$…$` rendered by `MathText` (`src/components/math-text.tsx`), which also draws
  `<u>…</u>` as underline (used for "underlined word" questions).

## Auth and roles

- `src/lib/auth.ts`: `getCurrentUser()` verifies the Firebase ID-token cookie (cached per request
  and up to 5 minutes); `requireUser()` redirects to `/login`, or to `/blocked` when
  `User.status = BLOCKED` (read fresh).
- **Two devices at most** (owner, 2026-10-15): each signed-in browser is a `UserDevice` (id in the
  httpOnly `prep_device` cookie, `src/server/devices.ts`). A third sign-in gets 409 `DEVICE_LIMIT`
  with the other two, and the login screen lets the user remove one. `requireUser` checks the device
  every request; a missing/removed one goes to `/api/auth/device` (registers old sessions, or signs
  out with `/login?device=removed|limit`). Sign-out removes only this device and no longer revokes the
  account's refresh tokens (that signed the other device out too). Unused 30 days → no longer counts.
- **One study timer across devices**: `ActiveTimer` (one row per user, `src/server/actions/timer.ts`)
  synced by `TimerSync` (claim on start — if another device's timer runs, that one is shown instead;
  pause/resume/stop passed on). Changes are pushed as a socket.io `timer` event (needs the realtime
  server, `REALTIME_URL`), else polled every 10 s and on focus. Rules: while a local change is saving
  — and for any reading that began before it — server readings are ignored (a mid-save poll used to
  bring a stopped timer back); the server decides on open, so a timer stopped elsewhere while this
  device was closed stops here too (only a start that never reached the server, or a timer from before
  sharing — `prep:timer-synced` — is sent again). The local zustand store still ticks.
- Roles: `USER`, `ADMIN` (= staff), and one **super admin** fixed by email in `src/server/roles.ts`
  (`roleOf`, `isAdminUser`, read fresh from the DB). Any staff: no AI limits, every exam open, voice.
- **Staff permissions** (2026-10-15, `User.staffPermissions`, list in `src/lib/staff.ts`): `billing`,
  `customers`, `question_bank`, `vocabulary`, `staff`. Gate admin work with `can(user, "…")` /
  `permissionsOf` (super admin = all); the admin menu follows them. Managed on `/admin/staff`
  (`src/server/actions/staff.ts`): nobody changes the super admin or themselves, and a manager
  gives/takes only permissions they hold (`mergePermissions`). Customer controls (block, AI pause,
  cancel) are on `/admin/customers` (`customers` permission; staff targets: super admin only).
  Phone numbers and phone search stay super-admin only. Prices and the OpenAI balance: super admin only.
- AI access is gated by plans/entitlements (`src/server/ai-access.ts` `checkAi(user, kind, ref)`):
  pass the kind (`message` / `scan` / `suggestion`) for anything the user starts, so it counts toward
  the tier's per-day limit; automatic follow-ups (the spell check after a scan) pass none.
- **Right over fast for facts** (owner, 2026-10-16: the AI gave many wrong facts). The quick intent
  call marks fact questions `lookup` (empty reply); `answer(…, { careful })` then answers with
  `reasoning: "medium"` + web search (75 s; without search, medium and streamed) and an accuracy rule
  (check names/years/numbers, say when unsure, one-line source). Chat/advice stays on the fast path.
  `callAI`'s `reasoning` option is also used by vocabulary explanations (medium) and note quizzes
  (low, a batch job inside 60 s).
- **Bank solutions are book pages** (owner, 2026-10-18): `/api/question-bank/solve` asks for Quill
  HTML — the solution, and an explanation in `<h3>` parts (মূল কথা, সাল ও ইতিহাস as a table,
  উদাহরণ, আরও জেনে রাখো, অন্য option, মনে রাখার কৌশল; only the parts that apply) — with web
  search + medium reasoning (`callAI` passes `responseSchema` to search too), falling back to medium
  without search. About 20 s a question: one per call, three at a time, `maxDuration` 120. Search's
  inline sources are stripped (`stripCitations`). Solution columns hold plain text (older) or HTML:
  `src/lib/solution-html.ts` shows both (`BookText`), `cleanSolution` sanitizes on save, staff edit
  them in Quill, and the beautify route leaves HTML ones alone. Limit `SOLUTION_MAX` (20 000).
- **No AI without a plan**: every OpenAI call goes through `checkAi` first (no plan, expired, out
  of tokens or paused → refused; admins always pass). Audited 2026-10-13: 14 entry points, all gated.
- **Voice is admin-only** (mic, speech-to-text, read-aloud, voice chat, voice forms — including the
  browser's own recognizer and voice). One exception (owner, 2026-10-15): the 🔊 next to vocabulary
  words (`src/lib/pronounce.ts`, browser speechSynthesis, no AI) is free for everyone. `src/lib/voice-access.ts` is switched on by `AppShell` for
  admins only, and `/api/speech`, `/api/transcribe`, `/api/transcribe/live` check `isAdminUser`.
- Solutions/explanations need a running plan (admins always): `hasPremium` / `gateNotes` in
  `src/server/premium.ts`. Also paid: AI note writing (`writeNoteWithAi` in `src/server/note-writer.ts`:
  the AI sees the note as numbered blocks and returns only edits — replace / insert after / delete —
  applied by `src/lib/note-blocks.ts`; rewriting a long note in full timed out. Shown with undo; up to 5 reference photos are each read word for word by
  `/api/notes/read-image` — one per request, large enough for Bangla print, counted as one scan via a
  shared `batch` ref — and the note is then rewritten from their text with medium reasoning), Note → Preliminary (`generateQuizFromNote`, up to 50: over 20 the note is split into parts asked in parallel; AI drafts MCQs,
  the dialog shows every answer, saved only on approve) and vocabulary explanations. Question-bank content (and copies of bank sets) is per exam:
  `canOpenExam` (`src/server/pricing.ts`) / `premiumForSet`. Gate on the server, never only in the UI.
- Prices are never stored per plan or taken from the client: `src/lib/pricing.ts` computes them
  from `PricingSettings` + `AiTier` + `ExamTrack` + `PlanDuration`; only the super admin edits those.

## Folder map

- `src/app/(app)/*`: signed-in pages (dashboard, tasks, notes, subjects, plan, progress, revisions,
  timer, preliminary, short-questions, confusions, vocabulary, typing, jobs, usage, billing, admin).
  The shell/nav is `src/components/app-shell.tsx` (sidebar on desktop; on phones Home, Tasks, "+", Notes, More — Jobs is under More since 2026-10-18; a once-a-day dialog, `JobsReminder`, shows the job links to check).
- `src/app/api/*`: route handlers (assistant, speech, transcribe, extract/spellcheck for question
  sets, vocabulary AI fill, …).
- `src/components/<feature>/*`: feature UI. `src/server/actions/*`: server actions per feature.
- `src/lib/*`: pure helpers (dates in `dayjs.ts` with `APP_TIMEZONE`, parsing for question sets,
  voice hooks, Bangla numbers…). `src/lib/vocabulary/*`: verb/noun/affix helpers.
- `prisma/`: schema, migrations, `seed-vocabulary.ts`. `docs/`: feature plans.

## Data model (overview — see `prisma/schema.prisma` for fields)

- `User` (firebaseUid, email, role, status, AI flags) owns almost everything (`onDelete: Cascade`).
- Study: `Subject` → `Topic` (tree, per user, `@@unique([userId, name])` on Subject), `Task`,
  `StudySession`, `StudyPlan`, `DailyPlanStart`, `Note` (+ `TaskNote` links).
  `StudyPlan.longTermDeadline` is legacy (owner removed "চূড়ান্ত লক্ষ্য" from the form, 2026-10-15): the
  column is NOT NULL, so saving mirrors `preparationDeadline` into it and nothing shows it. The
  dashboard countdown runs to the age limit (birth date given) or else to the preparation deadline;
  days left to the preparation deadline show on /plan and on the dashboard. Dropping the column
  needs a migration (ask first).
- Question sets: `QuestionSet` + `Question` + `TestAttempt` (Preliminary, MCQ);
  `ShortQuestionSet` + `ShortQuestion` + `ShortTestAttempt` (self-marked). Both use
  `QuestionSetStatus` TODO → DOING → TESTING → DONE; answers never reach the page during TESTING.
- Sets and confusions are filed under the owner's subject → topic tree: `subjectId` + optional
  `topicId` (a `Topic`; `QuestionSet.topicName` is the set's own name, not a topic). Boards filter by
  subject → topic (a topic includes its sub-topics; URL `?subject=&topic=`, logic in
  `src/lib/subject-filter.ts`); items with no (existing) subject show under **Other**.
- `StudyVideo` (per user): a saved YouTube video id + title/channel from oEmbed, optional subject;
  unique per user+video.
- `Confusion` (CONFUSION → CLEAR; old entries may have a free-text `topic`, kept for display). Jobs: `JobApplication`. Billing: `PlanPackage`, `Payment`,
  `Entitlement`, `AiUsage`.
- Question Bank (shared): `BankCategory` (3 built-ins tied to `BankExam`, + admin-added) →
  `BankSet` (section + name, `year`, `free`; `exam` mirrors the category) → `BankQuestion` (4–5
  options, solution, explanation, fingerprint; in a set **or** a chapter, `free` for chapters).
  General: `BankSubject` → `BankChapter` → `BankArticle` / `BankQuestion` / `BankShortQuestion`.
  A user's copy of a set is a normal `QuestionSet` with `bankSetId` (one per user per bank set); a
  chapter sent to Preliminary / Short Question is a plain new set each time. Preliminary `Question` allows 4–5 options and stores
  solution/explanation, hidden during a test like the answer.
- Vocabulary (shared, not per user): `VerbEntry`, `NounEntry`, `AffixEntry` — built-in rows come
  from the seed (no `userId`); admins add more; `VocabLearned` = per-user ticks.
- Affiliate: `AffiliateSettings` (one row), `User.affiliateCode/affiliateActive/referredById`,
  `AffiliateClick`, `AffiliateCommission` (one per payment), `AffiliatePayout`, `Payment.creditUsedBdt`.
- Collaboration: `FriendRequest` (history; one PENDING per pair via a partial unique index),
  `Friendship` (one row per pair, `userAId < userBId`), `ShareRequest` (frozen `payload`,
  `createdItemId` set once on accept; one PENDING per item+recipient), `Notification` (friend/share
  events only), `Conversation` (1:1, per-side `…LastReadAt`) + `Message` (plain text).
- Group chat: `ChatGroup` (outlives its creator) + `ChatGroupMember` (the row is the permission;
  leaving deletes it) + `GroupMessage` (TEXT or SYSTEM lines). `User.phone` is private
  (`+8801XXXXXXXXX`, only the user and the super admin's user list).

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Core study app (tasks, notes, subjects, plan, timer, revisions, progress) | done | |
| Preliminary / Short Question sets (AI read from photos twice + spellcheck, paste, voice, merge without duplicates, exam, results) | done | |
| Confusions (photo → text) | done | Confusion + clarification are Quill rich text (math via the fx formula button, live preview) since 2026-10-14; older rows are plain text, shown via `toEditorHtml` |
| Vocabulary (verbs, persons, singular/plural, prefix/suffix; admin-only adding; per-user learned ticks) | done | data via `pnpm db:seed-vocabulary`. Mobile cards since 2026-10-15: 🔊 per word (free); "AI দিয়ে বোঝাও" (`/api/vocabulary/explain`, `vocabulary` permission) saves a Bangla `explanation` on the word; it opens on tap and only paid users (and staff) get the text — `gateExplanation` in the list actions (migration `20261024000000_vocab_explanation` applied) |
| Typing lab (Bijoy engine) | done | |
| **Vocabulary Done + exams** (a learned word leaves the lists for the Done tab: flashcards, three exams — drag the other form, drag the meaning, spelling — wrong answers wait in "ভুলগুলো"; sets of 50: a full set takes no more ticks until all three exams reach 80%, counted after it filled; home page bar) | **built 2026-10-18; migration `20261031000000_vocab_exams` (additive; existing ticks start in set 1) applied by the deploy 2026-10-18; not tried signed in** | Logic in `src/lib/vocabulary/exam.ts` (questions from the tables, no AI); status in `src/server/vocab-progress.ts`; `setLearned` enforces the lock; the person table is outside it. **Example sentences** (2026-10-18): 6 per word with Bangla (verb 2 per form, noun 3+3, affix 6 words) in `sentences` JSON (migration `20261101000000_vocab_sentences`), written by staff via `/api/vocabulary/sentences` (per word, or the bulk button), paid users read them (`gateExplanation`) |
| **Collaboration: friends, sharing, notifications, chat (socket.io)** | **built; awaiting integration run + two-browser check** | plan + decisions: [docs/collaboration-plan.md](docs/collaboration-plan.md) |
| **Subscription pricing** (System + AI tier + exam, "all exams" discount, durations, per-day AI limits, super-admin pricing panel, SSLCommerz beside bKash/Nagad) | **phase 1 built; migration applied 2026-10-14; Plans page/admin panel not yet tried signed in; SSLCommerz untested** | [docs/subscription-plan.md](docs/subscription-plan.md) — phases 2 (security) and 3 (mobile API) not started |
| **Video library** (`/videos`: paste a YouTube link, watch it in the app; free 5, a running plan no limit) | **built; migration applied (seen 2026-10-15)** | Player: youtube-nocookie embed, `rel=0`, our own cover while paused/ended (hides YouTube's "More videos" and end screen); title strip blocked so taps don't leave the app. Limit checked in `addVideo`; videos stay playable after a plan ends |
| **OpenAI balance on /usage** (super admin: dollars added, spent, left) | **built; migration applied 2026-10-15; needs `OPENAI_ADMIN_KEY`** | OpenAI has no API for the prepaid balance, so the owner enters top-ups (`AiCredit`); spending comes from OpenAI's Costs API (`src/server/openai-costs.ts`, admin key only, cached 5 min) from the earliest top-up; left = added − spent |
| **Customers page** (`/admin/customers`, `customers` permission; staff not listed: Paid now / আগে নিয়েছিল (plan ended) / Free (never bought), search, paging) | built 2026-10-15 | Groups come from `Entitlement.endsAt` (cancel sets it to the cancel time); shows phone, the plan(s) (running ones, or the last bought), total paid, plan end, last AI use. No schema change |
| **Staff page + permissions** (`/admin/staff`; old `/admin/users` redirects) | **built; migration applied 2026-10-15; not yet tried signed in** | Existing admins get billing, question_bank, vocabulary (what admins could do before) |
| **Device limit (2) + shared timer** | **built; migration `20261025000000_devices_and_shared_timer` applied 2026-10-15; not yet tried signed in on real devices** | see Auth and roles. Check: sign in on 2 browsers, a 3rd shows the chooser; start a timer on one, the other shows it within 15 s |
| **Affiliate program** (`/affiliate`, `/admin/affiliates`; `?ref=CODE` links shared anywhere; commission on approved payments; every rule two-way, super admin picks) | **built 2026-10-17; migration `20261029000000_affiliate` applied; not tried signed in** | [docs/affiliate-plan.md](docs/affiliate-plan.md). Program starts **off** — turn it on at /admin/affiliates |
| Set audio (TTS MP3 per set on Cloudflare R2) | planned, not started | owner deferred it |
| **Question Bank v2** (two halves: **General** subject → chapter → Article / MCQ / Short Question, and **বিগত বছরের প্রশ্ন** category → year → set; free/paid per item; staff add, upload .xlsx or paste text that AI sorts per chapter, move — sets into chapters with an AI duplicate check — price; no plan: any 3 past-year sets to read, nothing to Preliminary; plan: 2 bank sets at a time per kind until 60%) | **built; migrations `20261026000000_question_bank_v2` (75 BCS + 91 grade sets backfilled, 51 without a year) and `20261027000000_bank_limits` applied 2026-10-16; not tried signed in** | [docs/question-bank-v2-plan.md](docs/question-bank-v2-plan.md) (v1: [docs/question-bank-plan.md](docs/question-bank-plan.md)). Access in `src/server/bank-access.ts`; the three built-in categories keep `exam` so plan prices still come from `canOpenExam`. Old `/question-bank/[exam]/…` URLs redirect |
| **Profile page (name + phone)** | **built; migration applied to Neon 2026-10-13** | [docs/profile-and-group-chat-plan.md](docs/profile-and-group-chat-plan.md) §1. Sign-in no longer overwrites a name the user saved (`profileUpdatedAt`) |
| **Group chat (3–20 friends)** | **built; migration applied 2026-10-13; integration tests + three-browser check not run** | same doc §2. Separate tables (`ChatGroup`, `ChatGroupMember`, `GroupMessage`); 1:1 chat untouched |

### Collaboration progress (update as each step lands)

- [x] M0 — this file + plan answers recorded
- [x] M1 — schema + migration `20261014000000_collaboration` (applied to Neon 2026-10-14)
- [x] M2 — friends (`src/server/actions/friends.ts`; on Messages: “Friend” dialog to add, the chat’s ⋮ menu to remove, Requests chip; friends show in the chat list, no separate friend list)
- [x] M3 — notifications + live updates (`/api/live`, bell, dashboard requests card, `LiveProvider`)
- [x] M4 — sharing: note, task, Preliminary set, Short Question set (`shares.ts`, `share-copy.ts`, `ShareButton`)
- [x] M5 — messages + socket.io server (`messages.ts`, `chat-panel.tsx`, `realtime/`)
- [ ] M6 — **run `pnpm test:integration`** (needs `.env.test`), **two-browser manual check**, deploy the
  socket server (owner's VPS, later)

What is verified so far: unit tests (13), `tsc`, `eslint`, `next build`, and the socket server
(token auth, `/emit` auth, per-user rooms) run locally. The integration suite
(`src/server/collaboration/collaboration.itest.ts`: friends, all four share types incl. double
accept, rejection, authorization, chat order/unread/paging, unfriend → read-only) is written but has
**not run yet** — it needs a Neon branch URL in `.env.test`.

Key rules (details in the plan): friends only for sharing and chat; the recipient previews the
whole shared item (`SharePreviewDialog`) and can accept only from there; a share is a copy frozen at send
time and lands in the recipient's section (subject matched by name or created); accept is
idempotent (conditional status update + `createdItemId` in one transaction); exact-email search
only, strangers see a masked email; unfriending keeps chat history read-only and cancels waiting
shares; Postgres is the source of truth and socket.io only pushes, with polling as the fallback.
Server-only helpers that take a user id live in `src/server/collaboration/*` — **never export them
from a `"use server"` file**, or the browser could call them with someone else's id.

## Testing and verification

- Before every commit: `pnpm typecheck` and `pnpm lint` (on the changed files at least).
- Unit tests (`pnpm test`, vitest) cover pure logic; they must not touch the database.
- Integration checks run against the Neon **test branch** in `.env.test` only (`pnpm test:integration`).
  Create it in the Neon console: Branches → New branch from `main` → copy its connection string into
  `.env.test` as `DATABASE_URL=…` (git-ignored). The branch starts as a copy, so its schema is current;
  the tests make their own users (`…@example.test`) and delete them afterwards.
- Collaboration by hand: two browsers (one private window) signed in as two accounts — friend
  request → accept, share each type → accept, chat both ways (with and without `pnpm realtime`).
- UI: the owner checks pages in the browser; signed-out `curl` only shows a 307 to `/login`.
  After a schema change, restart dev and watch `.next/dev/logs/next-development.log` for errors.

## Known issues and gotchas

- **Thrown messages from server actions are hidden in production** (React #441; found and fixed
  2026-10-16, checked in a production build): all server throws now use `userError`, all toasts
  `errorMessage`. Anything else thrown shows only the fallback, so internal details never leak.
- `AGENTS.md` is rewritten by `next dev`; keep the `@AGENTS.md` line at the top of this file.
- The Prisma CLI prints an upgrade notice for v8; stay on 6.19 unless deliberately upgrading.
- Vercel runs migrations but **not seeds**; a new database needs `pnpm db:seed-vocabulary` once.
