import "server-only";

/**
 * Post to the guild's Slack channel as the GuildBoard bot.
 *
 * Needs two env vars, both server-only:
 *   SLACK_BOT_TOKEN   the Bot User OAuth Token (xoxb-...), from the app's
 *                     "OAuth & Permissions" page after installing it with the
 *                     `chat:write` scope
 *   SLACK_CHANNEL_ID  the channel to post in (C0123...). The bot has to be a
 *                     member: `/invite @GuildBoard` in the channel.
 *
 * Unset means off. Local dev and preview deployments stay silent unless
 * someone opts them in, which is also how a test channel is used: point
 * SLACK_CHANNEL_ID at it.
 *
 * Same rule as push: a failed post must never fail the mutation that caused
 * it, so this never throws. It logs Slack's error code, never the token, and
 * resolves to whether Slack accepted the message (false when turned off).
 */

const TIMEOUT_MS = 5000;

export function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
}

/** Slack mrkdwn treats these three as control characters in any text field. */
export function escapeSlack(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The address every outgoing link uses. Fixed, not taken from the environment:
 * a message posted from a dev server or a preview deployment still lands in
 * the real channel and on real phones, where a localhost or *.vercel.app link
 * opens for nobody.
 */
export const PUBLIC_APP_URL = "https://guildboard.skillrev.in";

/** An absolute link back into the app. Slack cannot follow a relative path. */
export function appLink(path: string, label: string): string {
  return `<${PUBLIC_APP_URL}${path}|${escapeSlack(label)}>`;
}

/** A link to anywhere, for Slack mrkdwn. */
export function extLink(url: string, label: string): string {
  return `<${url.replace(/[<>|]/g, "")}|${escapeSlack(label)}>`;
}

export interface SlackMessage {
  /** Plain fallback: shown in notifications and to screen readers. Required. */
  text: string;
  /** Block Kit layout. Optional; `text` alone is a valid message. */
  blocks?: unknown[];
}

export async function postToSlack(message: SlackMessage): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return false;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text: message.text,
        blocks: message.blocks,
        // Links back to the board would otherwise each unfurl into a card
        // and bury the message under previews.
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Slack answers 200 with `ok: false` for most failures.
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!data?.ok) console.warn("slack post failed", data?.error ?? res.status);
    return !!data?.ok;
  } catch (err) {
    console.warn("slack post failed", err instanceof Error ? err.name : "unknown");
    return false;
  }
}
