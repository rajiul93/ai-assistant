# Collaboration: friends, sharing, notifications and chat — plan

Status: **approved 2026-10-13 — built 2026-10-14; integration run + manual check pending** (progress in `CLAUDE.md` → Feature status).
Answers to the review questions are in §12; where they differ from the decisions below, §12 wins. "Primarily" in the request means the **Preliminary** section (MCQ
question sets).

---

## 1. Audit (Phase 1)

### Stack and conventions found
- **Next.js 16.3.5** App Router with Turbopack. Route guarding lives in `src/proxy.ts` (Next 16's
  replacement for middleware). Read `node_modules/next/dist/docs/` before using unfamiliar APIs
  (see `AGENTS.md`).
- **React 19**, TypeScript strict, Tailwind 4, Radix UI, lucide icons, `sonner` toasts,
  `@tanstack/react-query` (already installed and used), zustand for client stores.
- **Prisma 6.19 + Neon Postgres.** Migrations are hand-written, idempotent SQL in
  `prisma/migrations/*`, applied with `prisma migrate deploy` (also run by the Vercel production
  build). Never use `prisma migrate dev` or a shadow DB: that once wiped the Neon database.
- **Auth: Firebase.** The client signs in with the Firebase Auth SDK, and the server verifies the
  ID-token cookie (`src/lib/auth.ts`: `getCurrentUser` is cached per request and for up to 5
  minutes). `requireUser()` redirects anyone signed out to `/login` and anyone blocked to `/blocked`.
  Roles come from `src/server/roles.ts` (`roleOf`, `isAdminUser`), read fresh from the database.
- **Mutations are server actions** in `src/server/actions/*.ts` (`"use server"`). They call
  `requireUser()`, parse input with zod, check ownership with `findFirst({ where: { id, userId } })`,
  and then call `revalidatePath`. Route handlers under `src/app/api/*` are used for AI calls and streams.
- UI copy is in Bangla. Comments explain *why*, not *what*.
- **There is no test runner** (no vitest or jest), and no real-time infrastructure: no websockets,
  and Firestore is not used, although the `firebase` SDK and the project credentials are already
  configured.
- Deployed on **Vercel (serverless)**. Long-lived socket servers are not available there.

### Models the feature touches
| Item | Model | Owner field | Points at per-user data |
|---|---|---|---|
| Note | `Note` (sanitized Quill HTML + `plainText`) | `userId` | `subjectId?`, `topicId?`, task links (`TaskNote`) |
| Task | `Task` | `userId` | `subjectId?`, `topicId?`, `position`, linked notes |
| Preliminary | `QuestionSet` + `Question[]` (+ `TestAttempt[]`) | `userId` | `subjectId` (required by the form) |
| Short Question | `ShortQuestionSet` + `ShortQuestion[]` (+ attempts) | `userId` | `subjectId` (required by the form) |

`Subject` and `Topic` belong to one user (`@@unique([userId, name])` on Subject), so **a shared
item can't keep the sender's subject or topic id**. It has to be re-mapped to the recipient's own
subjects and topics (D3).

### Reusable pieces
- `requireUser`, `isAdminUser`, zod and the server-action pattern, react-query.
- The `AppShell` nav (`src/components/app-shell.tsx`): a links array, a 4-tab phone bar plus a
  "More" sheet, and an existing badge mechanism (pending payments).
- The voice-input hook `useBestMic` (could later dictate chat messages; not in scope now).

### Constraints and risks
1. Serverless hosting means no persistent websockets (D8).
2. **The dev and production apps appear to share one Neon database.** Migrations applied locally
   were treated as already applied in production. Testing with fake users would then write into the
   real database (Q5).
3. No test runner exists (Q6).
4. Sharing has to copy rows across users without leaking the sender's other data.

---

## 2. Decisions (proposed — confirm or change in review)

**D1. Sharing requires an existing friendship** (recommended). There is one permission rule for
both sharing and chat, users can't be spammed by strangers, and nobody can probe accounts by
sharing to random emails. The alternative (Q1) is to let a share go to any registered email; the
share then works like a friend request.

**D2. A share is a copy taken when it's sent.** The item's content is frozen into
`ShareRequest.payload` (JSON) at send time. Accepting creates a brand-new item owned by the
recipient. There is no live sync: later edits or deletion by the sender don't affect the copy, and
the recipient's edits don't affect the original. The sender can cancel a pending share. A snapshot
also means the sender can't change what the recipient is accepting after the request is sent.

**D3. Subject and topic re-mapping on accept.** The recipient's subject is found by name
(case-insensitive); if it doesn't exist it's created. The topic is matched by name under that
subject; if there's no match it's left empty (no topic tree is created). Preliminary and Short
Question sets always get a subject, because their forms require one.

**D4. What is copied:**
| Type | Copied | Reset / not copied |
|---|---|---|
| Note | title, content (HTML, re-sanitized on accept), plainText, subject/topic name | task links |
| Task | title, description, estimatedMinutes, dueDate, priority, subject/topic name | status → NOT_STARTED, timesRevised → 0, position → top, linked notes |
| Preliminary set | topicName, date, every question (text, 4 options, correctIndex), subject name | status → TODO, test attempts |
| Short Question set | topicName, date, every question + answer, subject name | status → TODO, test attempts |

**D5. Accepting is idempotent.** Accept runs in one transaction: a conditional update moves the
status from `PENDING` to `ACCEPTED` (`updateMany … where status = PENDING`), and only if it changed a
row is the copy created, with `createdItemId` stored on the request. A second accept, or a
double-click in two tabs, finds the request already accepted and returns the existing item. No
duplicate is created.

**D6. Friend request rules**
- One pending request per pair of users (enforced by a database index).
- Sending to someone who already has a pending request to you **accepts theirs** instead of
  creating a second one.
- No self-requests, no requests to blocked accounts, and none to existing friends.
- After a rejection, the sender may ask again later (no cooldown in v1).
- Removing a friend deletes the friendship, cancels pending shares between the two, and keeps the
  chat history **read-only** (it can be read, but nothing new can be sent).

**D7. Searching users by email**
- Only an exact, whole-email match, case-insensitive. No partial search, so nobody can list users.
- It returns only id, name and an avatar initial. Other people's emails are shown only to friends.
- Blocked accounts and yourself are excluded.

**D8. Real-time delivery: polling first** (recommended for v1; Q2).
- The open chat polls for new messages every **3 seconds** while the tab is visible and pauses
  when it's hidden.
- Badges and notifications poll one small endpoint every **20 seconds**, and also on tab focus and
  right after your own actions.
- Polling needs no new dependency or service and works on Vercel as it is.
- It sits behind one hook, `useLiveUpdates`, so a push channel can replace it later without UI
  changes. The upgrade path is **Firestore as a signal channel**: the SDK is already installed and
  users are already Firebase-signed-in. The server writes a "something changed" ping to
  `signals/{userId}`, and the client listens and refetches from Postgres. Data stays in Postgres;
  Firestore only carries pings. This needs Firestore enabled and security rules (`request.auth.uid`
  matches the doc).
- Rejected for v1: SSE (Vercel limits how long a function can run, and it would still poll the
  database underneath), and Pusher or Ably (a new paid dependency).

**D9. Notifications**
- A persisted `Notification` row is written for friend requests (received, accepted, rejected) and
  shares (received, accepted, rejected). It's written **in the same transaction** as the event, so
  you can't get an event without its notification.
- Chat is **not** one row per message; that would flood the list. Unread chat counts come from the
  messages themselves. The bell shows notification items plus a "N new messages from X" line per
  conversation, computed live, so it survives refresh and sign-in.
- Mark one as read, or all as read. Old read notifications can be pruned later (out of scope).

**D10. Pages**
- **Messages** gets a nav entry with an unread badge. On phones it goes in "More" with a badge
  (Q3 offers a tab-bar slot instead).
- `/messages` has tabs **Chats · Friends · Requests**.
- Notifications use a bell in the shell header with a dropdown, plus a `/notifications` page.
- The dashboard gets a "Requests" card listing pending friend and share requests with
  Accept/Reject, as the spec asks.

---

## 3. Data model (additive migration `…_collaboration`)

```prisma
enum RequestStatus { PENDING ACCEPTED REJECTED CANCELLED }
enum ShareItemType { NOTE TASK PRELIMINARY_SET SHORT_QUESTION_SET }
enum NotificationType {
  FRIEND_REQUEST FRIEND_ACCEPTED FRIEND_REJECTED
  SHARE_REQUEST SHARE_ACCEPTED SHARE_REJECTED
}

model FriendRequest {            // history kept; one PENDING per unordered pair
  id String @id @default(cuid())
  fromId String; toId String     // -> User, onDelete Cascade
  status RequestStatus @default(PENDING)
  createdAt DateTime @default(now()); respondedAt DateTime?
  @@index([toId, status]) @@index([fromId, status])
}

model Friendship {               // stored once per pair: userAId < userBId
  userAId String; userBId String // -> User, onDelete Cascade
  createdAt DateTime @default(now())
  @@id([userAId, userBId]) @@index([userBId])
}

model ShareRequest {
  id String @id @default(cuid())
  senderId String; recipientId String     // -> User, onDelete Cascade
  itemType ShareItemType
  sourceItemId String            // the sender's item at send time (no FK: it may be deleted later)
  title String                   // for lists and notifications
  payload Json                   // frozen copy (D2), validated with zod per type on accept
  status RequestStatus @default(PENDING)
  createdItemId String?          // the recipient's copy, set once on accept (D5)
  createdAt DateTime @default(now()); respondedAt DateTime?
  @@index([recipientId, status]) @@index([senderId, status])
}

model Notification {
  id String @id @default(cuid())
  userId String                  // recipient -> User, onDelete Cascade
  type NotificationType
  actorId String?                // who caused it -> User, onDelete SetNull
  friendRequestId String?; shareRequestId String?   // what it is about (SetNull)
  readAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt]) @@index([userId, createdAt])
}

model Conversation {             // 1:1, one per pair: userAId < userBId
  id String @id @default(cuid())
  userAId String; userBId String // -> User, onDelete Cascade
  userALastReadAt DateTime?; userBLastReadAt DateTime?
  lastMessageAt DateTime?
  createdAt DateTime @default(now())
  @@unique([userAId, userBId]) @@index([userBId])
}

model Message {
  id String @id @default(cuid())
  conversationId String          // -> Conversation, onDelete Cascade
  senderId String                // -> User, onDelete Cascade
  body String                    // plain text, 1..4000 chars, rendered as text (never HTML)
  createdAt DateTime @default(now())
  @@index([conversationId, createdAt])
}
```

Raw SQL in the migration (Prisma can't express these):
- one pending friend request per unordered pair:
  `CREATE UNIQUE INDEX … ON "FriendRequest" (LEAST("fromId","toId"), GREATEST("fromId","toId")) WHERE status = 'PENDING'`
- no duplicate pending share of the same item to the same person:
  `CREATE UNIQUE INDEX … ON "ShareRequest" ("senderId","recipientId","itemType","sourceItemId") WHERE status = 'PENDING'`
- `CHECK ("userAId" < "userBId")` on `Friendship` and `Conversation`.

These are all new tables. No existing table or row changes.

---

## 4. Backend

Server actions follow the existing pattern (`requireUser` → zod → authorization → transaction →
`revalidatePath`):

- `src/server/actions/friends.ts`: `findUserByEmail`, `sendFriendRequest`, `respondFriendRequest`
  (accept/reject), `cancelFriendRequest`, `removeFriend`, `listFriends`, `listFriendRequests`.
- `src/server/actions/shares.ts`: `shareItem(type, itemId, friendId)`, `respondShare(id, accept)`,
  `cancelShare`, `listShares` (incoming and outgoing).
- `src/server/actions/notifications.ts`: `listNotifications`, `markNotificationsRead(ids | "all")`.
- `src/server/actions/messages.ts`: `openConversation(friendId)`, `sendMessage(conversationId, body)`,
  `markConversationRead`, `listConversations`.
- `src/server/collaboration/*` (shared server code, not actions): `friendship.ts` (`areFriends`,
  pair ordering), `share-copy.ts` (payload builders and the per-type copy-on-accept with D3/D4),
  `notify.ts` (writes a notification inside a given transaction).

Route handlers, for polling: plain GETs that react-query can cache.
- `GET /api/live` returns `{ notificationsUnread, messagesUnread, pendingRequests, latestAt }`
  using one cheap query set.
- `GET /api/messages/[conversationId]?after=<id>|before=<id>` returns 30 messages per page, newest
  first, using a `(createdAt, id)` cursor.

**Authorization (all on the server):**
| Action | Rule |
|---|---|
| Share an item | item.userId = me; recipient is a friend; recipient not blocked |
| Accept or reject a share | request.recipientId = me and status PENDING |
| Cancel a share | request.senderId = me and status PENDING |
| Answer a friend request | request.toId = me |
| Open a chat or send a message | I am a member of the conversation **and** we are friends now |
| Read chat history | I am a member (read-only after unfriending, D6) |
| Notifications | notification.userId = me |

---

## 5. Frontend

- **Share button** on: a note (notes workspace), a task (task card menu), a Preliminary set card,
  and a Short Question set card. `ShareDialog` lists friends (with search), sends the share, and
  shows "already shared and waiting" for pending ones. With no friends yet, it links to Friends.
- **Accept dialog** previews the item first: type, title, number of questions, subject. On accept
  it shows a toast with an "Open" link to the new item in its section.
- `/messages`
  - **Chats:** conversations sorted by last message, with unread counts. Selecting one opens the
    chat: messages oldest → newest, "load older" at the top, timestamps, own and other bubbles, a
    text box, and Enter to send. On phones the list and the chat are separate screens
    (`/messages/[friendId]`).
  - **Friends:** add by email, the friend list, remove (with confirm), and "message".
  - **Requests:** incoming and outgoing friend requests, and incoming shares.
  - **States:** loading skeletons, empty ("no friends yet — add by email"), error with retry, and
    a connection note ("পুনরায় সংযোগ হচ্ছে…") when polling fails.
- **Shell:** a bell with an unread count, opening a dropdown of the latest 10 and a link to
  `/notifications`. "Messages" gets an unread badge.
- **Dashboard:** a "Requests" card, shown only when something is pending.

---

## 6. Real-time and notification flow

1. An action (share, friend request, message) writes its rows and notification in one transaction.
2. The sender's UI updates at once (optimistic for chat; refetch for the rest).
3. The recipient's `useLiveUpdates` poll (20s, on focus, or 3s in an open chat) sees the new counts
   or messages and refetches only what changed.
4. Read state: opening a chat sets `lastReadAt` to now (debounced), and opening the bell marks the
   shown notifications as read.
5. To upgrade later, only `useLiveUpdates` changes, to a Firestore signal subscription (D8).

---

## 7. Security and edge cases

- Every action and route checks `requireUser` (blocked accounts are already redirected), and every
  input is parsed with zod (ids, enum types, message length, email format).
- The payload is built on the server from the owned item, never from client input, and is
  re-validated with zod when accepted. Note HTML is re-sanitized with the existing
  `sanitizeNoteHtml`.
- Users are exposed only as id, name and initial. Emails are shown only between friends.
- **Races:**
  - double accept → D5;
  - simultaneous mutual friend requests → the unique index, then the transaction falls back to accept;
  - double-sending a share → the unique index returns "already shared".
- Deleted accounts cascade. A deleted sender doesn't break the recipient's copy, because the
  payload is self-contained.
- An unfriended chat is read-only; sending is refused on the server.
- Limits: message 4,000 characters; payload ≤ 300 questions (the existing set limit); a light limit
  of 30 friend requests per user per day (counted in the database, no new dependency).
- No raw HTML is rendered in chat, so there's no XSS path.

---

## 8. Testing and acceptance

There's no test runner today (Q6). Proposed:
- **Unit tests** for the pure logic: pair ordering, payload builders and copies per type, subject
  re-mapping, and the read and unread arithmetic. This needs `vitest` as a dev dependency.
- **An integration script** that runs the full flows against a **separate Neon branch database**
  (Q5): two users become friends, share each of the 4 types, accept twice (still one copy),
  reject, unfriend (chat becomes read-only), confirm a non-friend is refused, and check that unread
  counts go up and down.
- **Manual checklist** in two browsers (two accounts) for the UI states and polling latency.
- **Regression:** `tsc`, `eslint`, and a smoke check that the existing pages still render.

Each acceptance criterion from the brief maps to one of these checks. A feature is marked done
in CLAUDE.md only after its checks pass.

---

## 9. Implementation order (each step is shippable on its own)

| # | Step | Done when |
|---|---|---|
| M0 | Rewrite `CLAUDE.md` (architecture, conventions, schema, auth, DB rules, decisions) and link this plan | a fresh session can follow it |
| M1 | Prisma models + idempotent migration; apply after approval | `migrate deploy` clean; existing pages unaffected |
| M2 | Friends: search, request, accept/reject, list, remove + Friends/Requests UI | the friend flows pass |
| M3 | Notifications: table writes, `/api/live`, bell, dashboard card, `useLiveUpdates` | they persist across refresh |
| M4 | Sharing, all 4 types: dialog, payload, accept/reject, re-mapping, idempotency | each type lands in its section, with no duplicates |
| M5 | Messages: conversations, chat, pagination, unread, read-only after unfriend | the chat checks pass in two browsers |
| M6 | Polish, full regression, final CLAUDE.md status update | all acceptance criteria met |

**Dependencies:** none new for the product. `vitest` (dev only) only if Q6 says yes. Firestore
push only if Q2 says yes, and it uses the already-installed `firebase` SDK.

---

## 10. CLAUDE.md plan (M0)

`CLAUDE.md` must keep its `@AGENTS.md` line (`next dev` rewrites AGENTS.md). Add:
- stack and folder map;
- conventions (server actions, zod, ownership checks, Bangla copy, comment style);
- **database rules** (hand-written idempotent migrations, `migrate deploy` only, never shadow or
  reset, ask before writes, restart dev after `prisma generate`, the vocabulary seed);
- auth and roles;
- the schema overview;
- feature status and known issues;
- testing and verification steps;
- links to this plan and to any later feature docs.

---

## 11. Open questions (please answer before implementation)

1. **Sharing without friendship?** D1 says only to friends. Should a share to any registered email
   also be allowed?
2. **Real-time:** is polling (about 3 seconds in an open chat, 20 seconds for badges) enough for
   v1, or should Firestore push be built now (you'd need to enable Firestore in the Firebase
   console)?
3. **Phone navigation:** Messages in "More" with a badge, or should it replace one of the 4 tab-bar
   items (Dashboard, Tasks, Notes, Jobs)?
4. **Subject re-mapping (D3):** is creating a missing subject in the recipient's account OK?
5. **Database for testing:** do local dev and production use the same Neon database? If yes, may I
   create a Neon branch (or should you) for the integration tests, so test users never touch real
   data?
6. **Tests:** may I add `vitest` as a dev dependency for unit tests, or keep to scripted and manual
   checks?
7. **Scope check:** sharing a note doesn't carry its linked tasks, and sharing a task doesn't carry
   its notes (D4). OK for v1?

---

## 12. Review answers (2026-10-13) — these override the decisions above

1. **Friends only** (D1 as proposed): sharing is limited to friends.
2. **Real-time uses socket.io** (replaces D8's polling-first). socket.io needs a long-running server,
   and Vercel functions are short-lived, so:
   - a standalone **socket.io server** lives in this repo under `realtime/` and runs next to
     `next dev` locally; it will be hosted on the owner's VPS later (instructions in
     `realtime/README.md`);
   - **Postgres stays the source of truth.** The Next app writes messages and notifications, then
     tells the socket server (`POST /emit`, shared secret) which users to notify. The socket server
     only pushes events to `user:<id>` rooms;
   - clients authenticate to the socket server with a short-lived token signed by the Next app
     (`/api/realtime/token`, HMAC with `REALTIME_SECRET`), so the socket server needs neither the
     database nor Firebase;
   - if the socket is unreachable the client **falls back to polling** (`/api/live`), so nothing is
     lost while the socket server is down or not deployed;
   - env: `REALTIME_SECRET` (both sides), `REALTIME_URL` (the Next server → socket server),
     `NEXT_PUBLIC_REALTIME_URL` (browser → socket server).
3. **Navigation:** "Messages" sits right **below "Typing Lab"** in the sidebar (on phones it is in
   "More", with an unread badge).
4. **Subject re-mapping (D3):** create the subject if missing. The recipient can then change the
   subject or topic freely; the existing edit forms already allow it.
5. **Dev and production share one Neon database.** Integration tests run only against a **separate
   Neon branch** whose URL is kept in `.env.test` (never committed) — a test script refuses to run
   when that URL equals `DATABASE_URL`.
6. **`vitest`** is added as a dev dependency for unit tests.
7. Linked notes and tasks are **not** carried with a share in v1 (D4 as proposed).

**Follow-up (2026-10-14):** the recipient must be able to **see everything inside a share before
accepting**. `getSharePreview` (recipient only; note HTML re-sanitized) feeds `SharePreviewDialog`,
which shows the full note, the task details, or every question with its options/correct answer or
answer. The only "accept" button for shares is inside that dialog — the requests card and the bell
offer "দেখো ও নাও" instead; rejecting still works directly.
