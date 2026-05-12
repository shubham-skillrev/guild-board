import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";

// ─── Copy bank — desi guild flavour ─────────────────────────
// Keep it short, warm, slightly playful. No emojis overload.
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Tone: Hinglish, dev-aware, Swiggy-style. Action clear in first 3-4 words.
// Mild masala, no over-the-top filmy lines.
// Vibe: warm Hinglish, mildly playful, never preachy.
// Clear action in title. Body adds context + tiny smile.
const COPY = {
  newTopic: {
    titles: [
      "Naya topic on the board",
      "Fresh idea just dropped",
      "Board pe kuch hone wala hai",
      "Charcha for the cycle",
    ],
    body: (author: string, title: string) =>
      `${author} pitched "${title}". Ek nazar daal lo.`,
  },
  vote: {
    titles: [
      "Vote mila tumhe",
      "Upvote landed",
      "Aapke topic ko thumbs up",
      "Someone backed your idea",
    ],
    body: (voter: string, title: string) =>
      `${voter} upvoted "${title}". Hawaa banti ja rahi hai.`,
  },
  contribute: {
    titles: [
      "Topic Saathi mil gaya",
      "Someone joined in",
      "Aapke topic pe ek aur",
      "Team building up",
    ],
    body: (helper: string, title: string) =>
      `${helper} jumped in on "${title}". Plan banao saath mein.`,
  },
  reply: {
    titles: [
      "Reply aaya hai",
      "Naya reply",
      "Aapko jawab mila",
      "Thread mein hulchul",
    ],
    body: (author: string, preview: string) => `${author}: ${preview}`,
  },
  comment: {
    titles: [
      "Aapke topic pe comment",
      "Charcha shuru ho gayi",
      "Naya comment",
      "Someone weighed in",
    ],
    body: (author: string, preview: string) => `${author}: ${preview}`,
  },
  like: {
    titles: [
      "Wah, kya baat hai",
      "Aapka comment pasand aaya",
      "Ek like aa gaya",
      "Comment ne taali bajwa di",
    ],
    body: (liker: string, preview: string) =>
      `${liker} liked: "${preview}"`,
  },
  spark: {
    titles: [
      "Aapko spark mila",
      "Spark drop, congrats",
      "Kisi ne aap chuna",
      "Cycle ka spark aapke naam",
    ],
    body: (giver: string) =>
      `${giver} sparked you this cycle. Kamaal kar diya.`,
  },
  selected: {
    titles: [
      "Aapka topic select hua",
      "Topic on the agenda",
      "Bajao taali, selected",
      "Shortlist mein aap",
    ],
    body: (title: string) =>
      `"${title}" is on this cycle's agenda. Tayyari shuru.`,
  },
  cycleOpen: {
    titles: [
      "Naya cycle shuru",
      "Cycle open hai",
      "Time to pitch",
      "Board khul gaya",
    ],
    body: (label: string) =>
      `${label} cycle is live. Drop your topics and vote on others.`,
  },
  cycleEnded: {
    titles: [
      "Cycle wrap-up time",
      "Spark window khula",
      "Time to spark someone",
      "Cycle ka end, sparks shuru",
    ],
    body: (label: string) =>
      `${label} discussions are done. Give your one spark to someone who stood out.`,
  },
};

const truncate = (s: string, n = 100) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ─── Helpers ─────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

async function getUsername(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from("users").select("username").eq("id", userId).single();
  return data?.username ?? "Koi";
}

async function getTopic(admin: Admin, topicId: string) {
  const { data } = await admin
    .from("topics")
    .select("id, user_id, title, is_anonymous")
    .eq("id", topicId)
    .single();
  return data;
}

async function getCommentAuthorPref(admin: Admin, userId: string, key: "push_replies" | "push_reactions") {
  const { data } = await admin
    .from("notification_prefs")
    .select(key)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return true;
  return (data as Record<string, boolean>)[key] !== false;
}

// ─── Event handlers ──────────────────────────────────────────

export async function notifyOnNewTopic(args: { topicId: string; actorId: string }) {
  const admin = createAdminClient();
  const topic = await getTopic(admin, args.topicId);
  if (!topic) return;

  const author = topic.is_anonymous ? "Kisi guild member" : await getUsername(admin, args.actorId);
  const url = `/board/${topic.id}`;

  // Broadcast to everyone with a subscription except the author.
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .neq("user_id", args.actorId);

  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
  if (!userIds.length) return;

  await sendPushToUsers(userIds, {
    title: pick(COPY.newTopic.titles),
    body: COPY.newTopic.body(author, truncate(topic.title, 60)),
    url,
    tag: `topic:${topic.id}`,
  });
}

export async function notifyOnVote(args: { topicId: string; actorId: string }) {
  const admin = createAdminClient();
  const topic = await getTopic(admin, args.topicId);
  if (!topic || topic.user_id === args.actorId) return;
  if (topic.is_anonymous) return;

  const voter = await getUsername(admin, args.actorId);

  await sendPushToUser(topic.user_id, {
    title: pick(COPY.vote.titles),
    body: COPY.vote.body(voter, truncate(topic.title, 50)),
    url: `/board/${topic.id}`,
    tag: `vote:${topic.id}`,
  });
}

export async function notifyOnContribute(args: { topicId: string; actorId: string }) {
  const admin = createAdminClient();
  const topic = await getTopic(admin, args.topicId);
  if (!topic || topic.user_id === args.actorId) return;
  if (topic.is_anonymous) return;

  const helper = await getUsername(admin, args.actorId);

  await sendPushToUser(topic.user_id, {
    title: pick(COPY.contribute.titles),
    body: COPY.contribute.body(helper, truncate(topic.title, 50)),
    url: `/board/${topic.id}`,
    tag: `contrib:${topic.id}`,
  });
}

export async function notifyOnComment(args: {
  topicId: string;
  parentCommentId: string | null;
  actorId: string;
  body: string;
}) {
  const admin = createAdminClient();

  let recipientId: string | null = null;
  let isReply = false;

  if (args.parentCommentId) {
    const { data: parent } = await admin
      .from("comments")
      .select("user_id")
      .eq("id", args.parentCommentId)
      .single();
    recipientId = parent?.user_id ?? null;
    isReply = true;
  } else {
    const topic = await getTopic(admin, args.topicId);
    if (topic && !topic.is_anonymous) recipientId = topic.user_id;
  }

  if (!recipientId || recipientId === args.actorId) return;
  if (!(await getCommentAuthorPref(admin, recipientId, "push_replies"))) return;

  const actor = await getUsername(admin, args.actorId);
  const preview = truncate(args.body, 100);
  const titles = isReply ? COPY.reply.titles : COPY.comment.titles;
  const body = isReply ? COPY.reply.body(actor, preview) : COPY.comment.body(actor, preview);

  await sendPushToUser(recipientId, {
    title: pick(titles),
    body,
    url: `/board/${args.topicId}`,
    tag: `comment:${args.topicId}`,
  });
}

export async function notifyOnLike(args: { commentId: string; actorId: string }) {
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("user_id, topic_id, body")
    .eq("id", args.commentId)
    .single();
  if (!comment || comment.user_id === args.actorId) return;
  if (!(await getCommentAuthorPref(admin, comment.user_id, "push_reactions"))) return;

  const liker = await getUsername(admin, args.actorId);

  await sendPushToUser(comment.user_id, {
    title: pick(COPY.like.titles),
    body: COPY.like.body(liker, truncate(comment.body as string, 60)),
    url: `/board/${comment.topic_id}`,
    tag: `like:${args.commentId}`,
  });
}

export async function notifyOnSpark(args: { toUserId: string; fromUserId: string }) {
  if (args.toUserId === args.fromUserId) return;
  const admin = createAdminClient();
  const giver = await getUsername(admin, args.fromUserId);

  await sendPushToUser(args.toUserId, {
    title: pick(COPY.spark.titles),
    body: COPY.spark.body(giver),
    url: `/profile`,
    tag: `spark:${args.fromUserId}`,
  });
}

export async function notifyOnTopicSelected(args: { topicId: string }) {
  const admin = createAdminClient();
  const topic = await getTopic(admin, args.topicId);
  if (!topic) return;

  await sendPushToUser(topic.user_id, {
    title: pick(COPY.selected.titles),
    body: COPY.selected.body(truncate(topic.title, 60)),
    url: `/board/${topic.id}`,
    tag: `selected:${topic.id}`,
    requireInteraction: true,
  });
}

async function broadcast(payload: Parameters<typeof sendPushToUsers>[1], excludeUserId?: string) {
  const admin = createAdminClient();
  let q = admin.from("push_subscriptions").select("user_id");
  if (excludeUserId) q = q.neq("user_id", excludeUserId);
  const { data: subs } = await q;
  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
  if (!userIds.length) return;
  await sendPushToUsers(userIds, payload);
}

export async function notifyOnCycleOpen(args: { label: string }) {
  await broadcast({
    title: pick(COPY.cycleOpen.titles),
    body: COPY.cycleOpen.body(args.label),
    url: "/board",
    tag: `cycle-open:${args.label}`,
  });
}

export async function notifyOnCycleEnded(args: { label: string }) {
  await broadcast({
    title: pick(COPY.cycleEnded.titles),
    body: COPY.cycleEnded.body(args.label),
    url: "/leaderboard",
    tag: `cycle-end:${args.label}`,
    requireInteraction: true,
  });
}
