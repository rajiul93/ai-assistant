/**
 * End-to-end checks of friends, sharing, notifications, chat, group chat and the profile against the Neon test branch
 * (pnpm test:integration; see vitest.integration.config.mts). The real server actions run with
 * only sign-in replaced: `requireUser` returns whichever test user is "signed in".
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const signedIn = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string | null } }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => {
    if (!signedIn.user) throw new Error("not signed in");
    return signedIn.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { prisma } = await import("@/lib/prisma");
const friends = await import("@/server/actions/friends");
const shares = await import("@/server/actions/shares");
const messages = await import("@/server/actions/messages");
const groups = await import("@/server/actions/groups");
const profile = await import("@/server/actions/profile");
const realAuth = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
const notifications = await import("@/server/actions/notifications");
const { liveCounts } = await import("@/server/collaboration/live");
const { messagePage } = await import("@/server/collaboration/conversations");
const { groupMessagePage } = await import("@/server/collaboration/groups");
const { orderPair } = await import("@/lib/collaboration");

const run = `itest-${Date.now()}`;
type TestUser = { id: string; email: string; name: string | null };
let alice: TestUser, bob: TestUser, carol: TestUser;
const as = (user: TestUser) => { signedIn.user = user; };

async function makeUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${run}@example.test`;
  return prisma.user.create({ data: { firebaseUid: `${run}-${name}`, email, name }, select: { id: true, email: true, name: true } });
}

beforeAll(async () => {
  alice = await makeUser("Alice");
  bob = await makeUser("Bob");
  carol = await makeUser("Carol");
});

afterAll(async () => {
  // Groups outlive their creator by design, so they're removed by hand.
  const ids = (await prisma.user.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { id: true } })).map((user) => user.id);
  await prisma.chatGroup.deleteMany({ where: { createdById: { in: ids } } });
  // Everything else belongs to these users and goes with them (cascade).
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

describe("friends", () => {
  it("finds a user only by exact email, without showing a stranger's email", async () => {
    as(alice);
    const found = await friends.findUserByEmail(bob.email.toUpperCase());
    expect(found.found && !found.self && found.person.name).toBe("Bob");
    expect(found.found && !found.self && found.person.email).toBeNull();
    expect((await friends.findUserByEmail(`ob-${run}@example.test`)).found).toBe(false);
  });

  it("refuses self-requests and duplicate requests", async () => {
    as(alice);
    await expect(friends.sendFriendRequest(alice.id)).rejects.toThrow();
    await friends.sendFriendRequest(bob.id);
    await expect(friends.sendFriendRequest(bob.id)).rejects.toThrow();
  });

  it("notifies the recipient, and accepting twice befriends once", async () => {
    as(bob);
    expect((await liveCounts(bob.id)).pendingRequests).toBe(1);
    const { incoming } = await friends.listFriendsOverview();
    expect(incoming).toHaveLength(1);
    await Promise.all([friends.respondFriendRequest(incoming[0].id, true), friends.respondFriendRequest(incoming[0].id, true)]);
    expect(await prisma.friendship.count({ where: { OR: [{ userAId: bob.id }, { userBId: bob.id }] } })).toBe(1);
    as(alice);
    const list = await notifications.listNotifications();
    expect(list.filter((item) => item.type === "FRIEND_ACCEPTED")).toHaveLength(1);
  });

  it("a request back to someone who already asked accepts theirs", async () => {
    as(carol);
    await friends.sendFriendRequest(alice.id);
    as(alice);
    const result = await friends.sendFriendRequest(carol.id);
    expect(result.status).toBe("accepted");
    expect((await friends.listFriendsOverview()).friends.map((friend) => friend.id).sort()).toEqual([bob.id, carol.id].sort());
  });

  it("rejecting tells the sender", async () => {
    as(bob);
    await friends.sendFriendRequest(carol.id);
    as(carol);
    const { incoming } = await friends.listFriendsOverview();
    await friends.respondFriendRequest(incoming[0].id, false);
    as(bob);
    expect((await notifications.listNotifications()).some((item) => item.type === "FRIEND_REJECTED")).toBe(true);
  });
});

describe("sharing", () => {
  let subjectId: string;
  const items: Record<string, string> = {};

  beforeAll(async () => {
    subjectId = (await prisma.subject.create({ data: { userId: alice.id, name: "Bangla" } })).id;
    items.NOTE = (await prisma.note.create({ data: { userId: alice.id, title: "সন্ধি", content: "<p>নোট</p><script>x</script>", plainText: "নোট", subjectId } })).id;
    items.TASK = (await prisma.task.create({ data: { userId: alice.id, title: "সন্ধি পড়া", estimatedMinutes: 45, priority: "HIGH", status: "FINISHED", timesRevised: 3, subjectId } })).id;
    items.PRELIMINARY_SET = (await prisma.questionSet.create({ data: { userId: alice.id, subjectId, topicName: "সন্ধি MCQ", date: new Date(), status: "DONE", questions: { create: [{ position: 0, text: "প্রশ্ন", options: ["ক", "খ", "গ", "ঘ"], correctIndex: 2 }] } } })).id;
    items.SHORT_QUESTION_SET = (await prisma.shortQuestionSet.create({ data: { userId: alice.id, subjectId, topicName: "সন্ধি সংক্ষিপ্ত", date: new Date(), questions: { create: [{ position: 0, text: "প্রশ্ন?", answer: "উত্তর" }] } } })).id;
  });

  it("only friends can be offered an item, and only my own items", async () => {
    as(bob);
    await expect(shares.shareItem({ type: "NOTE", itemId: items.NOTE, friendIds: [alice.id] })).rejects.toThrow();
    as(carol);
    await expect(shares.shareItem({ type: "NOTE", itemId: "nope", friendIds: [alice.id] })).rejects.toThrow();
  });

  for (const type of ["NOTE", "TASK", "PRELIMINARY_SET", "SHORT_QUESTION_SET"] as const) {
    it(`${type}: lands in the right section once, under the recipient's own subject`, async () => {
      as(alice);
      await shares.shareItem({ type, itemId: items[type], friendIds: [bob.id] });
      const again = await shares.shareItem({ type, itemId: items[type], friendIds: [bob.id] });
      expect(again.alreadyPending).toBe(1);

      as(bob);
      const incoming = (await shares.listIncomingShares()).filter((share) => share.type === type);
      expect(incoming).toHaveLength(1);
      // The recipient sees everything inside before deciding.
      const preview = await shares.getSharePreview(incoming[0].id);
      expect(preview.content.type).toBe(type);
      if (preview.content.type === "PRELIMINARY_SET") expect(preview.content.data.questions[0].correctIndex).toBe(2);
      if (preview.content.type === "NOTE") expect(preview.content.data.content.includes("<script")).toBe(false);
      const [first, second] = await Promise.all([shares.respondShare(incoming[0].id, true), shares.respondShare(incoming[0].id, true)]);
      expect(first.path).toBe(second.path);
      const request = await prisma.shareRequest.findUniqueOrThrow({ where: { id: incoming[0].id } });
      expect(request.status).toBe("ACCEPTED");

      const bobSubject = await prisma.subject.findFirstOrThrow({ where: { userId: bob.id, name: "Bangla" } });
      if (type === "NOTE") {
        const note = await prisma.note.findUniqueOrThrow({ where: { id: request.createdItemId! } });
        expect([note.userId, note.subjectId, note.content.includes("<script")]).toEqual([bob.id, bobSubject.id, false]);
      }
      if (type === "TASK") {
        const task = await prisma.task.findUniqueOrThrow({ where: { id: request.createdItemId! } });
        expect([task.userId, task.status, task.timesRevised, task.priority, task.subjectId]).toEqual([bob.id, "NOT_STARTED", 0, "HIGH", bobSubject.id]);
      }
      if (type === "PRELIMINARY_SET") {
        const set = await prisma.questionSet.findUniqueOrThrow({ where: { id: request.createdItemId! }, include: { questions: true } });
        expect([set.userId, set.status, set.questions.length, set.questions[0].correctIndex]).toEqual([bob.id, "TODO", 1, 2]);
      }
      if (type === "SHORT_QUESTION_SET") {
        const set = await prisma.shortQuestionSet.findUniqueOrThrow({ where: { id: request.createdItemId! }, include: { questions: true } });
        expect([set.userId, set.questions[0].answer]).toEqual([bob.id, "উত্তর"]);
      }
    });
  }

  it("re-uses the recipient's subject instead of making a second one", async () => {
    expect(await prisma.subject.count({ where: { userId: bob.id, name: "Bangla" } })).toBe(1);
  });

  it("a rejected share creates nothing and tells the sender", async () => {
    as(alice);
    await shares.shareItem({ type: "NOTE", itemId: items.NOTE, friendIds: [carol.id] });
    as(carol);
    const [share] = await shares.listIncomingShares();
    await shares.respondShare(share.id, false);
    expect(await prisma.note.count({ where: { userId: carol.id } })).toBe(0);
    as(alice);
    expect((await notifications.listNotifications()).some((item) => item.type === "SHARE_REJECTED")).toBe(true);
  });

  it("nobody else can see or answer someone's share", async () => {
    as(alice);
    await shares.shareItem({ type: "TASK", itemId: items.TASK, friendIds: [carol.id] });
    const share = await prisma.shareRequest.findFirstOrThrow({ where: { recipientId: carol.id, status: "PENDING" } });
    as(bob);
    await expect(shares.getSharePreview(share.id)).rejects.toThrow();
    await expect(shares.respondShare(share.id, true)).rejects.toThrow();
  });
});

describe("chat", () => {
  let conversationId: string;

  it("friends can chat; messages are stored in order and counted unread", async () => {
    as(alice);
    conversationId = await messages.openConversation(bob.id);
    expect(await messages.openConversation(bob.id)).toBe(conversationId);
    for (const body of ["১", "২", "৩"]) await messages.sendMessage({ conversationId, body });
    expect(await liveCounts(bob.id)).toMatchObject({ messagesUnread: 3 });
    const page = await messagePage(conversationId, {});
    expect(page.messages.map((message) => message.body)).toEqual(["১", "২", "৩"]);
  });

  it("reading clears the unread count; replying keeps the sender's own count at zero", async () => {
    as(bob);
    await messages.markConversationRead(conversationId);
    expect((await liveCounts(bob.id)).messagesUnread).toBe(0);
    await messages.sendMessage({ conversationId, body: "ঠিক আছে" });
    expect((await liveCounts(bob.id)).messagesUnread).toBe(0);
    expect((await liveCounts(alice.id)).messagesUnread).toBe(1);
  });

  it("outsiders can't read or write the conversation, and strangers can't start one", async () => {
    as(carol);
    await expect(messages.sendMessage({ conversationId, body: "hi" })).rejects.toThrow();
    await expect(messages.markConversationRead(conversationId)).rejects.toThrow();
    as(bob);
    await expect(messages.openConversation(carol.id)).rejects.toThrow();
  });

  it("after unfriending the history stays but nothing new can be sent, and waiting shares are cancelled", async () => {
    as(alice);
    await shares.shareItem({ type: "NOTE", itemId: (await prisma.note.findFirstOrThrow({ where: { userId: alice.id } })).id, friendIds: [bob.id] });
    await friends.removeFriend(bob.id);
    await expect(messages.sendMessage({ conversationId, body: "আছো?" })).rejects.toThrow();
    expect((await messagePage(conversationId, {})).messages).toHaveLength(4);
    expect(await prisma.shareRequest.count({ where: { senderId: alice.id, recipientId: bob.id, status: "PENDING" } })).toBe(0);
    const chats = await messages.listConversations();
    expect(chats.find((chat) => chat.person.id === bob.id)?.isFriend).toBe(false);
  });

  it("older messages page backwards without gaps", async () => {
    as(carol);
    const id = await messages.openConversation(alice.id);
    for (let index = 0; index < 35; index++) await prisma.message.create({ data: { conversationId: id, senderId: carol.id, body: `m${index}`, createdAt: new Date(Date.now() + index) } });
    const latest = await messagePage(id, {});
    expect(latest.messages).toHaveLength(30);
    expect(latest.hasOlder).toBe(true);
    const older = await messagePage(id, { before: latest.messages[0].id });
    expect([...older.messages, ...latest.messages].map((message) => message.body)).toEqual(Array.from({ length: 35 }, (_, index) => `m${index}`));
  });
});

describe("group chat", () => {
  let dave: TestUser, erin: TestUser, finn: TestUser, gina: TestUser;
  let groupId: string;
  const befriend = (a: TestUser, b: TestUser) => {
    const [userAId, userBId] = orderPair(a.id, b.id);
    return prisma.friendship.create({ data: { userAId, userBId } });
  };

  beforeAll(async () => {
    [dave, erin, finn, gina] = await Promise.all(["Dave", "Erin", "Finn", "Gina"].map(makeUser));
    // Dave is friends with everyone; Erin and Finn aren't friends with each other.
    await Promise.all([befriend(dave, erin), befriend(dave, finn), befriend(dave, gina)]);
  });

  it("needs at least two friends, and only friends", async () => {
    as(dave);
    await expect(groups.createGroup({ name: "একা", memberIds: [erin.id] })).rejects.toThrow();
    as(erin);
    await expect(groups.createGroup({ name: "অচেনা", memberIds: [dave.id, finn.id] })).rejects.toThrow();
  });

  it("creating adds everyone, notifies them, and members need not be friends with each other", async () => {
    as(dave);
    groupId = await groups.createGroup({ name: "পড়ার দল", memberIds: [erin.id, finn.id] });
    as(erin);
    expect((await notifications.listNotifications()).find((item) => item.type === "GROUP_ADDED")?.group?.id).toBe(groupId);
    const details = await groups.groupDetails(groupId);
    expect(details?.members.map((member) => member.name)).toEqual(["Dave", "Erin", "Finn"]);
    expect(details?.isAdmin).toBe(false);
    // Finn isn't Erin's friend: no email shown.
    expect(details?.members.find((member) => member.name === "Finn")?.email).toBeNull();
  });

  it("messages reach every member and count unread from when they joined", async () => {
    as(erin);
    await groups.sendGroupMessage({ groupId, body: "সবাইকে সালাম" });
    expect((await liveCounts(finn.id)).messagesUnread).toBe(1);
    expect((await liveCounts(erin.id)).messagesUnread).toBe(0);
    as(finn);
    await groups.markGroupRead(groupId);
    expect((await liveCounts(finn.id)).messagesUnread).toBe(0);
    const list = await groups.listGroups();
    expect(list[0]).toMatchObject({ id: groupId, memberCount: 3, unread: 0 });
  });

  it("only the admin renames, adds and removes; outsiders see nothing", async () => {
    as(erin);
    await expect(groups.renameGroup({ groupId, name: "নতুন" })).rejects.toThrow();
    await expect(groups.addGroupMembers({ groupId, memberIds: [gina.id] })).rejects.toThrow();
    await expect(groups.removeGroupMember({ groupId, userId: finn.id })).rejects.toThrow();
    as(gina);
    expect(await groups.groupDetails(groupId)).toBeNull();
    await expect(groups.sendGroupMessage({ groupId, body: "ঢুকতে চাই" })).rejects.toThrow();
    as(dave);
    await groups.addGroupMembers({ groupId, memberIds: [gina.id, gina.id] });
    expect(await prisma.chatGroupMember.count({ where: { groupId } })).toBe(4);
    // Gina joined after Erin's message: it isn't unread for her.
    expect((await liveCounts(gina.id)).messagesUnread).toBe(0);
  });

  it("a removed member loses access to the group", async () => {
    as(dave);
    await groups.removeGroupMember({ groupId, userId: gina.id });
    as(gina);
    expect(await groups.groupDetails(groupId)).toBeNull();
    expect(await groups.listGroups()).toHaveLength(0);
  });

  it("when the admin leaves, the earliest member takes over; the last one out deletes the group", async () => {
    as(dave);
    await groups.leaveGroup(groupId);
    as(erin);
    const details = await groups.groupDetails(groupId);
    expect(details?.members.filter((member) => member.role === "ADMIN").map((member) => member.name)).toEqual([expect.stringMatching(/Erin|Finn/)]);
    const page = await groupMessagePage(groupId, {});
    expect(page.messages.at(-1)?.body).toContain("এখন admin");
    await groups.leaveGroup(groupId);
    as(finn);
    await groups.leaveGroup(groupId);
    expect(await prisma.chatGroup.count({ where: { id: groupId } })).toBe(0);
  });
});

describe("profile", () => {
  it("saves name and a normalized phone, and sign-in keeps the user's own name", async () => {
    as(alice);
    await expect(profile.updateProfile({ name: "Alice Rahman", phone: "12345" })).rejects.toThrow();
    await profile.updateProfile({ name: "Alice Rahman", phone: "০১৭১২-৩৪৫৬৭৮" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: alice.id }, select: { name: true, phone: true, firebaseUid: true } });
    expect(row).toMatchObject({ name: "Alice Rahman", phone: "+8801712345678" });
    // A token check with the Google name must not undo the edit.
    const after = await realAuth.upsertUserFromToken(row.firebaseUid, alice.email, "Alice From Google");
    expect(after.name).toBe("Alice Rahman");
  });

  it("before any edit, sign-in still follows the Google name", async () => {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: carol.id }, select: { firebaseUid: true } });
    const after = await realAuth.upsertUserFromToken(row.firebaseUid, carol.email, "Carol New");
    expect(after.name).toBe("Carol New");
  });
});
