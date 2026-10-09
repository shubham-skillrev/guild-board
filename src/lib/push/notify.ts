import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";
import { HIDE_BYTES } from "@/lib/experiment";
import type { CycleTheme } from "@/lib/themes";
import type { AnnouncementChannel } from "@/lib/announce";
import { postToSlack, escapeSlack, appLink, extLink, PUBLIC_APP_URL } from "@/lib/slack/send";

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

const BASE_COPY = {
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
      `${label} is open. One post each, and two lines is enough.`,
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
    /* No "this week" here any more: the digest lands every other morning, and
       copy that names a cadence goes stale the moment the schedule changes. */
    titles: [
      "Tech, compressed",
      "Fresh bytes are up",
      "Today's diff",
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

// A problem post speaks in its own voice: a vote means "I've hit this too" and
// a hand raise means "I've dealt with this". Chosen by the post's kind, so a
// problem reads the same in any month and other kinds keep the base copy.
// The cycle-open message comes from the month's theme instead (see SLACK).
const PROBLEM_COPY: Pick<typeof BASE_COPY, "newTopic" | "vote" | "contribute"> = {
  newTopic: {
    titles: ["New problem on the board", "Someone's stuck on something", "Have you hit this?"],
    body: (author: string, title: string) =>
      `${author} shared "${title}". Hit this too? Say so before the meeting.`,
  },
  vote: {
    titles: ["Someone's hit this too", "You're not the only one", "+1 on your problem"],
    body: (voter: string, title: string) =>
      `${voter} has hit "${title}" too. Worth bringing to the meeting.`,
  },
  contribute: {
    titles: ["Someone's dealt with this", "Help has arrived", "Someone's been here before"],
    body: (helper: string, title: string) =>
      `${helper} has dealt with "${title}". Ask them what worked.`,
  },
};

const COPY = BASE_COPY;
const copyFor = (category: string | null | undefined) =>
  category === "problem" ? PROBLEM_COPY : BASE_COPY;

const truncate = (s: string, n = 100) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ─── Slack copy ──────────────────────────────────────────────
// The channel only hears about guild-wide moments: a new problem, a cycle
// opening, a digest. Votes, comments, likes and sparks are about one person
// and stay as push; in a channel of thirty they would be noise.
// No random title pool here: a channel reads top to bottom, and the same shape
// every time is what makes it scannable.
const SLACK = {
  newTopic: (author: string, title: string, id: string, category: string | null) =>
    category === "problem"
      ? `*New problem* from ${escapeSlack(author)}\n> ${escapeSlack(title)}\nHit this too? ${appLink(`/board/${id}`, "Say so on GuildBoard")}`
      : `*New post* from ${escapeSlack(author)}\n> ${escapeSlack(title)}\n${appLink(`/board/${id}`, "Join in on GuildBoard")}`,
  cycleOpen: (label: string, theme: CycleTheme | null) =>
    theme
      ? `*${escapeSlack(label)} is open. ${escapeSlack(theme.title)}*\n${escapeSlack(theme.open_line)} ${appLink("/board?share=1", theme.cta)}`
      : `*${escapeSlack(label)} is open.* One post each, two lines is enough. ${appLink("/board?share=1", "Share something")}`,
  meetingReminder: (when: string, count: number, top: { id: string; title: string }[]) => {
    const lines = [
      `*Guild tomorrow, ${escapeSlack(when)}.* ${count === 0 ? 'Nothing on the board yet.' : `${count} on the board.`}`,
    ];
    if (top.length) {
      lines.push("Most wanted so far:");
      top.forEach((t, i) => lines.push(`${i + 1}. ${appLink(`/board/${t.id}`, truncate(t.title, 90))}`));
    }
    lines.push(`Bring one thing to talk about: ${appLink("/board?share=1", "add yours")}`);
    return lines.join("\n");
  },
  systemTopics: (label: string, topics: SystemTopicNotice[]) =>
    [
      `*GuildBot suggested ${topics.length} ${topics.length === 1 ? 'topic' : 'topics'} for ${escapeSlack(label)}.* Mark the ones you want to talk about.`,
      ...topics.map(t => `• ${appLink(`/board/${t.id}`, truncate(t.title, 90))}`),
    ].join("\n"),
  /* The whole digest, one line per story, so the channel gets a glimpse of
     what is in it. Each line opens the story on GuildBoard, where the upvote
     that puts it on the agenda lives. */
  bytes: (label: string, parts: string[], items: ByteNotice[]) =>
    [
      `*Bytes · ${escapeSlack(label)}*${parts.length ? ` · ${parts.join(", ")}` : ""}`,
      ...items.map(b => `• ${appLink(`/bytes/${b.id}`, truncate(b.title, 90))}${b.source_name ? ` · _${escapeSlack(b.source_name)}_` : ""}`),
      appLink("/bytes", "Read it on GuildBoard"),
    ].join("\n"),
};

// ─── Helpers ─────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

async function getUsername(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from("users").select("username").eq("id", userId).single();
  return data?.username ?? "Koi";
}

async function getTopic(admin: Admin, topicId: string) {
  const { data } = await admin
    .from("topics")
    .select("id, user_id, title, is_anonymous, category")
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

  // Slack goes out regardless of how many members have push turned on.
  const slack = postToSlack({
    text: SLACK.newTopic(topic.is_anonymous ? "a guild member" : author, truncate(topic.title, 140), topic.id, topic.category),
  });

  // Broadcast to everyone with a subscription except the author.
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .neq("user_id", args.actorId);

  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
  await Promise.all([
    slack,
    userIds.length
      ? sendPushToUsers(userIds, {
          title: pick(copyFor(topic.category).newTopic.titles),
          body: copyFor(topic.category).newTopic.body(author, truncate(topic.title, 60)),
          url,
          tag: `topic:${topic.id}`,
        })
      : null,
  ]);
}

export async function notifyOnVote(args: { topicId: string; actorId: string }) {
  const admin = createAdminClient();
  const topic = await getTopic(admin, args.topicId);
  if (!topic || topic.user_id === args.actorId) return;
  if (topic.is_anonymous) return;

  const voter = await getUsername(admin, args.actorId);

  await sendPushToUser(topic.user_id, {
    title: pick(copyFor(topic.category).vote.titles),
    body: copyFor(topic.category).vote.body(voter, truncate(topic.title, 50)),
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
    title: pick(copyFor(topic.category).contribute.titles),
    body: copyFor(topic.category).contribute.body(helper, truncate(topic.title, 50)),
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

/** Push to every subscriber. Returns how many devices it reached. */
async function broadcast(payload: Parameters<typeof sendPushToUsers>[1], excludeUserId?: string) {
  const admin = createAdminClient();
  let q = admin.from("push_subscriptions").select("user_id");
  if (excludeUserId) q = q.neq("user_id", excludeUserId);
  const { data: subs } = await q;
  const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
  if (!userIds.length) return { sent: 0 };
  const { sent } = await sendPushToUsers(userIds, payload);
  return { sent };
}

/** The month's theme, when it has one, is the whole message. */
export async function notifyOnCycleOpen(args: { label: string; theme: CycleTheme | null }) {
  const { theme } = args;
  await Promise.all([
    postToSlack({ text: SLACK.cycleOpen(args.label, theme) }),
    broadcast({
      title: theme ? theme.title : pick(COPY.cycleOpen.titles),
      body: theme ? `${args.label} is open. ${theme.open_line}` : COPY.cycleOpen.body(args.label),
      url: "/board",
      tag: `cycle-open:${args.label}`,
    }),
  ]);
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
  digestId: string;
  label: string;
  count: number;
  mix?: { blog: number; news: number; video: number; hn: number };
}) {
  // With Bytes hidden this push would land on a redirect.
  if (HIDE_BYTES) return;
  const parts = describeMix(args.mix);
  const { data: rows } = await createAdminClient()
    .from("bytes")
    .select("id, source_title, source_name")
    .eq("digest_id", args.digestId)
    .order("position", { ascending: true });
  const items: ByteNotice[] = (rows ?? []).map(r => ({
    id: r.id,
    title: r.source_title,
    source_name: r.source_name,
  }));
  await Promise.all([
    postToSlack({ text: SLACK.bytes(args.label, parts, items) }),
    broadcast({
      title: pick(COPY.bytesPublished.titles),
      body: COPY.bytesPublished.body(args.label, args.count, parts),
      url: "/bytes",
      // One notification per digest label, so a re-run or a second device does
      // not buzz twice for the same week.
      tag: `bytes:${args.label}`,
    }),
  ]);
}

/**
 * The day before the session: the one message most likely to get people to
 * turn up with something to say. Goes to Slack and to every push subscriber.
 * The caller (a daily cron) decides whether today is the day.
 */
export async function notifyMeetingReminder(args: {
  cycleId: string;
  when: string;
}) {
  const admin = createAdminClient();
  const [{ count }, { data: top }] = await Promise.all([
    admin
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", args.cycleId)
      .eq("is_deleted", false),
    admin
      .from("topics")
      .select("id, title")
      .eq("cycle_id", args.cycleId)
      .eq("is_deleted", false)
      .order("score", { ascending: false })
      .limit(3),
  ]);
  const n = count ?? 0;

  await Promise.all([
    postToSlack({ text: SLACK.meetingReminder(args.when, n, top ?? []) }),
    broadcast({
      title: `Guild tomorrow, ${args.when}`,
      body:
        n === 0
          ? "Nothing on the board yet. Bring one thing to talk about."
          : `${n} on the board. Add yours, or mark what you want to talk about.`,
      url: "/board",
      tag: `meeting:${args.cycleId}`,
    }),
  ]);
}

/** One story in a digest, as the Slack message lists it. */
interface ByteNotice {
  id: string;
  title: string;
  source_name: string | null;
}

export interface SystemTopicNotice {
  id: string;
  title: string;
  why?: string;
  sources?: { name: string; url: string }[];
}

/** Every suggested topic as its own block: linked title, a line of what it is,
    and where it came from. The plain `text` stays as the notification preview. */
function systemTopicBlocks(label: string, topics: SystemTopicNotice[]): unknown[] {
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*GuildBot suggested ${topics.length} ${topics.length === 1 ? "topic" : "topics"} for ${escapeSlack(label)}.*\nMark the ones you want to talk about on the board.`,
      },
    },
    { type: "divider" },
  ];
  for (const t of topics) {
    const lines = [`*${appLink(`/board/${t.id}`, truncate(t.title, 100))}*`];
    if (t.why) lines.push(escapeSlack(truncate(t.why, 240)));
    if (t.sources?.length) lines.push(`_Sources:_ ${t.sources.slice(0, 3).map(s => extLink(s.url, s.name)).join(" · ")}`);
    blocks.push({ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } });
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `${appLink("/board", "Open the board")} · posted by GuildBot` }],
  });
  return blocks;
}

/**
 * GuildBot posted suggestions. One message for the batch, not one per topic,
 * with every topic linked.
 */
export async function notifyOnSystemTopics(args: {
  label: string;
  topics: SystemTopicNotice[];
}) {
  await Promise.all([
    postToSlack({
      text: SLACK.systemTopics(args.label, args.topics),
      blocks: systemTopicBlocks(args.label, args.topics),
    }),
    broadcast({
      title: "New on the board from GuildBot",
      body: `${args.topics.length} suggested ${args.topics.length === 1 ? "topic" : "topics"} for ${args.label}. Mark what you want to talk about.`,
      url: "/board",
      tag: `system-topics:${args.label}`,
    }),
  ]);
}

/**
 * An admin's announcement, word for word: the copy is theirs (or a Gemini
 * draft they edited), so nothing is added here. Returns what happened per
 * channel, for the history row.
 *
 * The push link is made absolute, on the public address. Subscriptions are
 * owned by the service worker of the origin they were made on, which resolves
 * a relative URL against itself, so after a domain move a relative link would
 * open the old address.
 */
export async function notifyAnnouncement(args: {
  id: string;
  title: string;
  body: string;
  slackText: string;
  url: string | null;
  channels: AnnouncementChannel[];
}): Promise<{ slackOk: boolean | null; pushSent: number | null }> {
  const origin = PUBLIC_APP_URL;
  const url = !args.url ? `${origin}/board` : /^https?:\/\//.test(args.url) ? args.url : `${origin}${args.url.startsWith("/") ? "" : "/"}${args.url}`;

  const [slackOk, push] = await Promise.all([
    args.channels.includes("slack") ? postToSlack({ text: args.slackText }) : Promise.resolve(null),
    args.channels.includes("push")
      ? broadcast({ title: args.title, body: args.body, url, tag: `announce:${args.id}`, requireInteraction: true })
      : Promise.resolve(null),
  ]);
  return { slackOk, pushSent: push ? push.sent : null };
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
