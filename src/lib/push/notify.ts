import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";

/**
 * Fire a notification without blocking the response.
 *
 * Route handlers must use this instead of `void notifyOnX()`. On serverless the
 * function can be frozen the moment the response is returned, so a bare
 * unawaited promise may never finish - every notifyOn* here does at least one
 * DB round-trip before it sends, and broadcasts do N more. `after()` keeps the
 * invocation alive until the callback settles.
 *
 * Errors are swallowed by design: a failed push must never fail the mutation
 * that triggered it.
 */
export function notifyAfterResponse(
  task: Promise<unknown>,
  label: string,
): void {
  after(async () => {
    try {
      await task;
    } catch (err) {
      console.warn(`${label} failed`, err);
    }
  });
}

// ─── Copy bank ───────────────────────────────────────────────
// Tone: English, dev-native, a little funny, never cutesy. Think boot.dev:
// playful about the craft, precise about the facts. Title says what happened,
// body says what it means and what to do. No em dashes anywhere in user copy.
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const COPY = {
  newTopic: {
    titles: [
      "New topic deployed",
      "Fresh idea on the board",
      "Someone shipped an idea",
      "Incoming: new topic",
    ],
    body: (author: string, title: string) =>
      `${author} pitched "${title}". Vote before the merge window closes.`,
  },
  vote: {
    titles: [
      "+1 to your idea",
      "Your topic got a vote",
      "Someone approved your PR",
      "Upvote incoming",
    ],
    body: (voter: string, title: string) =>
      `${voter} upvoted "${title}". Momentum is building.`,
  },
  contribute: {
    titles: [
      "You got a co-author",
      "Someone joined your topic",
      "Pair programmer found",
      "Backup has arrived",
    ],
    body: (helper: string, title: string) =>
      `${helper} raised a hand on "${title}". Two heads, one agenda item.`,
  },
  reply: {
    titles: [
      "New reply in your thread",
      "Someone replied",
      "Your thread has activity",
      "Response received",
    ],
    body: (author: string, preview: string) => `${author}: ${preview}`,
  },
  comment: {
    titles: [
      "New comment on your topic",
      "Discussion started",
      "Someone weighed in",
      "Your topic has traffic",
    ],
    body: (author: string, preview: string) => `${author}: ${preview}`,
  },
  like: {
    titles: [
      "Your comment landed",
      "Somebody liked that",
      "Nice take, apparently",
      "Comment approved",
    ],
    body: (liker: string, preview: string) => `${liker} liked: "${preview}"`,
  },
  spark: {
    titles: [
      "You got a spark",
      "Peer recognition unlocked",
      "Someone picked you",
      "Spark received",
    ],
    body: (giver: string) =>
      `${giver} gave you their one spark this cycle. That is the rarest currency here.`,
  },
  selected: {
    titles: [
      "Your topic made the agenda",
      "Shortlisted",
      "You are on the schedule",
      "Topic selected",
    ],
    body: (title: string) =>
      `"${title}" is on this cycle's agenda. Time to prep.`,
  },
  cycleOpen: {
    titles: [
      "New cycle is live",
      "Board is open",
      "Submissions open",
      "Fresh cycle, clean slate",
    ],
    body: (label: string) =>
      `${label} is open. You have 1 topic, 3 votes and 2 hand raises to spend.`,
  },
  cycleEnded: {
    titles: [
      "Cycle wrapped",
      "Spark window is open",
      "Time to hand out your spark",
      "That is a wrap",
    ],
    body: (label: string) =>
      `${label} is done. You have 48 hours to give your one spark to someone who showed up.`,
  },
  bytesPublished: {
    titles: [
      "This week in tech, compressed",
      "Fresh bytes are up",
      "Your weekly diff",
      "New bytes dropped",
    ],
    /* The breakdown is the part that earns the tap. "10 things worth knowing"
       is every newsletter ever written; "6 reads, 2 talks" tells you what you
       are opening and how long it will take. */
    body: (label: string, count: number, parts: string[]) =>
      parts.length
        ? `${label}: ${parts.join(", ")}. Upvote what you want on the meeting agenda.`
        : `${label}: ${count} things worth knowing. Upvote what you want on the meeting agenda.`,
  },
  asked: {
    titles: [
      "You have been summoned",
      "Someone wants your take",
      "Tagged in a topic",
      "Your expertise is requested",
    ],
    body: (asker: string, title: string, note: string | null) =>
      note
        ? `${asker} on "${title}": ${note}`
        : `${asker} thinks you would have something to say about "${title}".`,
  },
  explainMore: {
    titles: [
      "Someone wants more detail",
      "Question on your topic",
      "Clarification requested",
      "Your topic needs a docstring",
    ],
    body: (title: string) =>
      `Someone tapped "Explain more" on "${title}". A couple of lines would help.`,
  },
  ideaTaken: {
    titles: [
      "Your idea got picked up",
      "Someone forked your idea",
      "Idea promoted to the board",
      "Your bank paid out",
    ],
    body: (taker: string, title: string) =>
      `${taker} took "${title}" to the board. Your idea, their pitch.`,
  },
  bankNudge: {
    titles: [
      "You have unspent ideas",
      "Your bank has a balance",
      "Cash in an idea",
      "Board is open, bank is full",
    ],
    body: (count: number, label: string) =>
      count === 1
        ? `You have 1 banked idea and ${label} just opened. Put it on the board?`
        : `You have ${count} banked ideas and ${label} just opened. Pick one for the board.`,
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

/**
 * A digest went live. Deliberately timed mid-cycle: it lands in the stretch
 * where the board is locked and there is otherwise nothing to come back for.
 */
export async function notifyOnBytesPublished(args: {
  label: string;
  count: number;
  mix?: { blog: number; news: number; video: number; hn: number };
}) {
  await broadcast({
    title: pick(COPY.bytesPublished.titles),
    body: COPY.bytesPublished.body(args.label, args.count, describeMix(args.mix)),
    url: "/bytes",
    // One notification per digest label, so a re-run or a second device does
    // not buzz twice for the same week.
    tag: `bytes:${args.label}`,
  });
}

/** "6 reads, 2 talks, 2 from the news" - omitting whatever came back empty. */
function describeMix(mix?: {
  blog: number;
  news: number;
  video: number;
  hn: number;
}): string[] {
  if (!mix) return [];
  const reads = mix.blog + mix.hn;
  const parts: string[] = [];
  if (reads) parts.push(`${reads} ${reads === 1 ? "read" : "reads"}`);
  if (mix.video) parts.push(`${mix.video} ${mix.video === 1 ? "talk" : "talks"}`);
  if (mix.news) parts.push(`${mix.news} from the news`);
  return parts;
}

/**
 * Someone was invited into a topic by name. The asker IS named here - that is
 * the whole mechanism: a specific person asking you specifically is what makes
 * it answerable, where a general call to thirty people is not.
 */
export async function notifyOnAsked(args: {
  topicId: string;
  toUserId: string;
  askerId: string;
  title: string;
  note: string | null;
}) {
  if (args.toUserId === args.askerId) return;

  const admin = createAdminClient();
  const asker = await getUsername(admin, args.askerId);

  await sendPushToUser(args.toUserId, {
    title: pick(COPY.asked.titles),
    body: COPY.asked.body(asker, truncate(args.title, 50), args.note),
    url: `/board/${args.topicId}`,
    tag: `asked:${args.topicId}:${args.toUserId}`,
    requireInteraction: true,
  });
}

/**
 * Someone tapped "Explain more" - a question posed to the author without
 * anyone having to write a paragraph under their own name.
 *
 * The asker is intentionally not named: attaching a name to "I didn't
 * understand this" is the exact cost this signal exists to remove.
 */
export async function notifyOnExplainMore(args: {
  topicId: string;
  toUserId: string;
  title: string;
}) {
  await sendPushToUser(args.toUserId, {
    title: pick(COPY.explainMore.titles),
    body: COPY.explainMore.body(truncate(args.title, 60)),
    url: `/board/${args.topicId}`,
    // Collapse repeats: five people asking should not mean five buzzes.
    tag: `explain-more:${args.topicId}`,
  });
}

/** Someone promoted an open idea from the bank - tell whoever banked it. */
export async function notifyOnIdeaTaken(args: {
  toUserId: string;
  actorId: string;
  title: string;
  topicId: string;
}) {
  if (args.toUserId === args.actorId) return;

  const admin = createAdminClient();
  const taker = await getUsername(admin, args.actorId);

  await sendPushToUser(args.toUserId, {
    title: pick(COPY.ideaTaken.titles),
    body: COPY.ideaTaken.body(taker, truncate(args.title, 60)),
    url: `/board/${args.topicId}`,
    tag: `idea-taken:${args.topicId}`,
  });
}

/**
 * On cycle open, nudge only members holding unpromoted banked ideas.
 * Targeted rather than broadcast: a reason to act, not another announcement.
 */
export async function notifyOnCycleOpenWithBank(args: { label: string }) {
  const admin = createAdminClient();

  const { data: banked } = await admin
    .from("idea_bank")
    .select("user_id")
    .is("promoted_topic_id", null);

  if (!banked?.length) return;

  const counts = new Map<string, number>();
  for (const row of banked) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);

  await Promise.all(
    Array.from(counts.entries()).map(([userId, count]) =>
      sendPushToUser(userId, {
        title: pick(COPY.bankNudge.titles),
        body: COPY.bankNudge.body(count, args.label),
        url: "/bank",
        tag: `bank-nudge:${args.label}`,
      }).catch((err) => console.warn("bank nudge failed", err)),
    ),
  );
}
