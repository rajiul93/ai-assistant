# Profile page and group chat — plan

Status: **built 2026-10-13 (owner accepted every proposal in §4). Migrations written, not yet
applied to Neon; integration tests written, not yet run.**
Progress goes in `CLAUDE.md` → Feature status.

The owner asked for two things:

1. A **profile page** where a user sets their name and phone number.
2. **Group chat**: a user can make a group with a few of their friends and chat together.

The profile comes first: group chats show every member's name, and today many users have only a
Google name (or none, and strangers then see a masked email).

---

## 1. Profile page

### What exists today (checked in the code)

- `User` has `name` and `image` (from Google), no phone.
- **Sign-in overwrites the name.** `upsertUserFromToken` (`src/lib/auth.ts`) sets
  `name: decoded.name` on every token check, and `getCurrentUser` re-runs it at least every 5
  minutes. A name typed on a profile page would be reverted within 5 minutes. This must change.
- `getCurrentUser` keeps the user row in an in-memory map (`verifiedSessions`) for up to 5 minutes,
  so after saving a profile the shell could show the old name until it expires.

### Decisions (proposed)

- **P1. Sign-in stops overwriting a name the user set.** New field `profileUpdatedAt DateTime?`.
  `upsertUserFromToken` still fills `name` on create, and on update only while
  `profileUpdatedAt` is null (so Google name changes still flow in for users who never edited).
- **P2. Phone is stored normalized.** Accept `01XXXXXXXXX`, `+8801…`, `8801…`, spaces/dashes and
  Bangla digits; validate as a Bangladesh mobile (`01[3-9]` + 8 digits); store `+8801XXXXXXXXX`.
  A pure helper in `src/lib/phone.ts` with unit tests.
- **P3. Phone is private.** Only the user and admins (admin user list) see it. It is never in
  `publicPerson`, never sent to friends, never searchable. (Owner to confirm, Q-P1.)
- **P4. Not unique, not verified** in v1 (no SMS OTP, which costs money). Two accounts may type the
  same number. (Owner to confirm, Q-P2.)
- **P5. Optional, with a nudge.** The app works without a profile; the dashboard shows a small
  "প্রোফাইল সম্পূর্ণ করুন" card while name or phone is missing. (Owner to confirm, Q-P3.)

### Schema (additive)

```prisma
model User {
  // …
  phone            String?   // +8801XXXXXXXXX (P2); private (P3)
  profileUpdatedAt DateTime? // set when the user saves the profile; sign-in then keeps their name (P1)
}
```

### Code

- `src/server/actions/profile.ts`: `updateProfile({ name, phone })` — `requireUser()` → zod (name
  2–60 chars trimmed; phone optional, P2) → update `name`, `phone`, `profileUpdatedAt` →
  forget the cached session user → `revalidatePath("/", "layout")`.
- `src/lib/auth.ts`: P1 in `upsertUserFromToken` (the upsert no longer writes `name` on update;
  a conditional `updateMany … where profileUpdatedAt IS NULL` keeps the Google name in sync).
- The shell and dashboard read the name (and phone, for the reminder card) through
  `freshUserFlags`, which already runs once per request, so an edit shows at once without a
  per-instance cache flush (Vercel runs many instances).
- `/profile` page (`src/app/(app)/profile/page.tsx`): photo (from Google, read-only), name, phone,
  email (read-only), save button, toast on success. Linked from the avatar/menu in `app-shell.tsx`
  and the phone "More" sheet. Add `profile` to the voice assistant's pages.
- Admin user list: show the phone column.

---

## 2. Group chat

### What exists today

1:1 chat only: `Conversation` is a pair (`userAId < userBId`, per-side `…LastReadAt`), `Message`
belongs to one conversation, socket.io pushes to `user:<id>` rooms via `emitTo`, polling is the
fallback. The integration suite for it has **not run yet** (M6).

### Decisions (proposed)

- **G1. Separate tables, existing 1:1 chat untouched.** New `ChatGroup`, `ChatGroupMember`,
  `GroupMessage`. The alternative — one generic conversation with a member table — would mean
  migrating live 1:1 data and rewriting code that hasn't passed its integration run yet. Separate
  tables are purely additive. `groups.ts` has its own copy of the message paging (same cursors);
  sharing one function across two Prisma models wasn't worth the generics.
- **G2. Who can make a group:** any user, choosing members **from their own friends** only.
  Members need not be friends with each other; inside the group they see each other's name and
  photo only (no email, no phone) — `publicPerson(…, false)` rules.
- **G3. Size:** 3 to 20 people including the creator (2 people = the existing 1:1 chat).
  (Owner to confirm, Q-G1.)
- **G4. Roles:** the creator is the group admin. The admin renames the group, adds members (from
  the admin's own friends), and removes members. Anyone can leave. If the admin leaves, the oldest
  remaining member becomes admin. The last member leaving deletes the group. (Q-G2.)
- **G5. History after leaving/removal:** a member who leaves or is removed loses access to the
  group entirely (simplest and most private). A newly added member sees the whole earlier history.
  (Q-G3.)
- **G6. Unfriending does not touch groups.** Group membership is its own permission once added.
- **G7. System lines** in the chat ("রহিম গ্রুপে যোগ হয়েছেন", "নাম বদলে …") as `GroupMessage`
  rows with `kind = SYSTEM`, so history explains itself.
- **G8. Notifications:** a `GROUP_ADDED` notification when someone adds you. Ordinary messages are
  not notifications (same as 1:1); they show as unread counts.
- **G9. Delivery:** after saving, `emitTo(allActiveMemberIds, …)`. The socket server needs no
  change (it already accepts up to 500 user ids per emit). Polling covers it when socket is down.
- **G10. Blocked users** cannot send; their messages stay.

### Schema (additive)

```prisma
enum GroupRole { ADMIN MEMBER }
enum GroupMessageKind { TEXT SYSTEM }

model ChatGroup {
  id            String            @id @default(cuid())
  name          String
  createdById   String            // creator; not a cascade owner (the group outlives them, G4)
  lastMessageAt DateTime?
  createdAt     DateTime          @default(now())
  members       ChatGroupMember[]
  messages      GroupMessage[]
}

model ChatGroupMember {
  groupId    String
  userId     String            // onDelete: Cascade from User
  role       GroupRole         @default(MEMBER)
  joinedAt   DateTime          @default(now())
  lastReadAt DateTime?
  @@id([groupId, userId])
  @@index([userId])
}

model GroupMessage {
  id        String           @id @default(cuid())
  groupId   String
  senderId  String?          // null for SYSTEM lines; SetNull if the sender's account is deleted
  kind      GroupMessageKind @default(TEXT)
  body      String
  createdAt DateTime         @default(now())
  @@index([groupId, createdAt])
}

// NotificationType: + GROUP_ADDED  (ALTER TYPE … ADD VALUE IF NOT EXISTS)
```

Leaving/removal deletes the member row (G5), so "am I a member" is a single primary-key lookup.

### Code

- `src/server/collaboration/groups.ts` (server-only, **not** `"use server"`): `groupMember`,
  `groupMemberIds`, `lockGroup` (`SELECT … FOR UPDATE`, so concurrent adds can't pass the size limit
  and concurrent admin exits can't skip the hand-over), `groupMessagePage`, `groupUnreadCounts`.
- `GET /api/groups/[groupId]`: a page of messages plus sender names (past senders may have left).
- `Notification.groupId` (cascade with the group) so GROUP_ADDED links to the group.
- `src/server/actions/groups.ts`: `createGroup`, `renameGroup`, `addGroupMembers`, `removeGroupMember`,
  `leaveGroup`, `sendGroupMessage`, `markGroupRead`, `listGroups`, `groupDetails`. Every action checks membership
  (and admin role where needed) on the server; adds check friendship with the actor in the same
  transaction; size limit enforced in the transaction.
- Realtime events `group_message` and `group_changed`; the Messages badge (`/api/live`) counts
  1:1 and group unread together. The socket server needed no change.
- UI (`src/components/collaboration/`): the Messages list shows groups and 1:1 chats together,
  newest first, with unread counts; a "নতুন গ্রুপ" button (name + pick friends); a group chat panel
  (sender name above each message, since there are several people); a group info sheet (members,
  add, remove, rename, leave).

### Tests

- Unit: phone normalizer; size-limit and admin-succession helpers.
- Integration (`.env.test` branch): create with a non-friend → refused; non-member reads/sends →
  refused; member removed → loses access; admin leaves → oldest member becomes admin; last member
  leaves → group deleted; unread counts per member; profile save survives a sign-in token refresh.
- Manual: three browsers/accounts, a group chat with and without `pnpm realtime`.

---

## 3. Order of work

1. Owner answers §4.
2. Profile: migration (`phone`, `profileUpdatedAt`) → P1 fix → action + page → nav. Small; ship alone.
3. Group chat: migration → server helpers + actions → live events → UI → tests.
4. Finish collaboration M6 first or alongside — group chat builds on the same friend and socket
   code, so the 1:1 integration run should pass before groups are added on top.

Both migrations are hand-written, idempotent, additive, and **applied only after asking the owner**
(dev and production share one Neon database).

## 4. Owner's answers (2026-10-13: "ঠিক আছে" to every proposal)

| # | Question | Decided |
|---|---|---|
| Q-P1 | Who can see a user's phone number? | Only the user and admins |
| Q-P2 | Verify the phone with an SMS code? Must it be unique? | No and no (v1) |
| Q-P3 | Must new users fill the profile before using the app? | No; a reminder card on the dashboard |
| Q-P4 | Anything else on the profile (photo upload, district, target exam)? | Not in v1 |
| Q-G1 | Group size limit? | 3–20 people |
| Q-G2 | Can every member add people, or only the group admin? | Only the admin |
| Q-G3 | After leaving, can a member still read old messages? | No |
| Q-G4 | Can items be shared into a group (note, set…)? | Not in v1; later |
