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
- **Firebase Auth** (client SDK sign-in; firebase-admin on the server). AI via OpenAI
  (`src/server/assistant/ai.ts` `callAI`).
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
- Stop the dev server before `pnpm add`; installing under a running `next dev` breaks pages.
- Integration tests use a **separate Neon branch** in `.env.test` (git-ignored), never `DATABASE_URL`.

## Git

- Work and commit on **`dev`**; the owner merges `dev` → `main` (a PR), or asks for it explicitly.
- Commit messages: conventional (`feat(scope): …`), a body explaining why.

## Conventions

- **Server actions** in `src/server/actions/*.ts` (`"use server"`): `requireUser()` → parse input
  with **zod** → authorization (ownership via `findFirst({ where: { id, userId } })`, roles via
  `src/server/roles.ts`) → Prisma (a `$transaction` when several rows must change together) →
  `revalidatePath`. Throw `Error` with a short Bangla message; the UI shows it in a toast.
- **Route handlers** (`src/app/api/*`) for AI calls, streams, uploads and polling GETs. They call
  `requireUser()` too and return JSON `{ error }` with a status code on failure.
- Shared server-only helpers in `src/server/*`; pure helpers usable on both sides in `src/lib/*`.
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
- Roles: `USER`, `ADMIN`, and one **super admin** fixed by email in `src/server/roles.ts`
  (`roleOf`, `isAdminUser`, read fresh from the DB). Admins: no AI limits, admin pages, and they
  edit shared content (vocabulary).
- AI access is gated by plans/entitlements (`src/server/ai-access.ts` `checkAi(user, kind, ref)`):
  pass the kind (`message` / `scan` / `suggestion`) for anything the user starts, so it counts toward
  the tier's per-day limit; automatic follow-ups (the spell check after a scan) pass none.
- **No AI without a plan**: every OpenAI call goes through `checkAi` first (no plan, expired, out
  of tokens or paused → refused; admins always pass). Audited 2026-10-13: 14 entry points, all gated.
- **Voice is admin-only** (mic, speech-to-text, read-aloud, voice chat, voice forms — including the
  browser's own recognizer and voice): `src/lib/voice-access.ts` is switched on by `AppShell` for
  admins only, and `/api/speech`, `/api/transcribe`, `/api/transcribe/live` check `isAdminUser`.
- Solutions/explanations need a running plan (admins always): `hasPremium` / `gateNotes` in
  `src/server/premium.ts`. Question-bank content (and copies of bank sets) is per exam:
  `canOpenExam` (`src/server/pricing.ts`) / `premiumForSet`. Gate on the server, never only in the UI.
- Prices are never stored per plan or taken from the client: `src/lib/pricing.ts` computes them
  from `PricingSettings` + `AiTier` + `ExamTrack` + `PlanDuration`; only the super admin edits those.

## Folder map

- `src/app/(app)/*`: signed-in pages (dashboard, tasks, notes, subjects, plan, progress, revisions,
  timer, preliminary, short-questions, confusions, vocabulary, typing, jobs, usage, billing, admin).
  The shell/nav is `src/components/app-shell.tsx` (sidebar on desktop; 4-tab bar + "More" on phones).
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
- Question Bank (shared): `BankSet` (exam + section + session) → `BankQuestion` (4–5 options,
  solution, explanation, fingerprint). A user's copy is a normal `QuestionSet` with `bankSetId`
  (one per user per bank set). Preliminary `Question` allows 4–5 options and stores
  solution/explanation, hidden during a test like the answer.
- Vocabulary (shared, not per user): `VerbEntry`, `NounEntry`, `AffixEntry` — built-in rows come
  from the seed (no `userId`); admins add more; `VocabLearned` = per-user ticks.
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
| Confusions (photo → text) | done | |
| Vocabulary (verbs, persons, singular/plural, prefix/suffix; admin-only adding; per-user learned ticks) | done | data via `pnpm db:seed-vocabulary` |
| Typing lab (Bijoy engine) | done | |
| **Collaboration: friends, sharing, notifications, chat (socket.io)** | **built; awaiting integration run + two-browser check** | plan + decisions: [docs/collaboration-plan.md](docs/collaboration-plan.md) |
| **Subscription pricing** (System + AI tier + exam, "all exams" discount, durations, per-day AI limits, super-admin pricing panel, SSLCommerz beside bKash/Nagad) | **phase 1 built; migration applied 2026-10-14; Plans page/admin panel not yet tried signed in; SSLCommerz untested** | [docs/subscription-plan.md](docs/subscription-plan.md) — phases 2 (security) and 3 (mobile API) not started |
| **Video library** (`/videos`: paste a YouTube link, watch it in the app; free 5, a running plan no limit) | **built; migration `20261020000000_study_videos` not yet applied** | Player: youtube-nocookie embed, `rel=0`, our own cover while paused/ended (hides YouTube's "More videos" and end screen); title strip blocked so taps don't leave the app. Limit checked in `addVideo`; videos stay playable after a plan ends |
| Set audio (TTS MP3 per set on Cloudflare R2) | planned, not started | owner deferred it |
| **Question Bank** (BCS / প্রাইমারি / ১১–২০ গ্রেড; sets per exam session; "Preliminary-তে পাঠাও" copies a set; super admin uploads .xlsx) | **built; migration applied 2026-10-13; not yet tried with a real sheet** | [docs/question-bank-plan.md](docs/question-bank-plan.md) — sheet assumptions in §2 |
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

- `AGENTS.md` is rewritten by `next dev`; keep the `@AGENTS.md` line at the top of this file.
- The Prisma CLI prints an upgrade notice for v8; stay on 6.19 unless deliberately upgrading.
- Vercel runs migrations but **not seeds**; a new database needs `pnpm db:seed-vocabulary` once.
