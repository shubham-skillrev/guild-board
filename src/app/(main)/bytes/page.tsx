"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Broadcast } from "@phosphor-icons/react";
import { ByteCard, type Byte } from "@/components/bytes/ByteCard";
import { FormatFilter, type Format } from "@/components/bytes/FormatFilter";
import { useUnseenDigest } from "@/lib/bytes/useUnseenDigest";
import {
  PageHeader,
  SectionHeader,
  EmptyState,
  CardSkeleton,
} from "@/components/ui/Section";

interface Digest {
  id: string;
  label: string;
  kind?: string;
  period_start?: string | null;
  published_at: string | null;
}

function matches(byte: Byte, filter: Format): boolean {
  if (filter === "all") return true;
  const isVideo = byte.source === "video";
  return filter === "watch" ? isVideo : !isVideo;
}

export default function BytesPage() {
  const reduceMotion = useReducedMotion();
  const { markSeen } = useUnseenDigest();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [top, setTop] = useState<Byte[]>([]);
  const [bytes, setBytes] = useState<Byte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Format>("all");

  useEffect(() => {
    fetch("/api/bytes")
      .then((r) => r.json())
      .then((data) => {
        setDigest(data.digest ?? null);
        setTop(Array.isArray(data.top) ? data.top : []);
        setBytes(Array.isArray(data.bytes) ? data.bytes : []);
        // Opening the page is the whole definition of "seen"; this is what
        // clears the dot in the nav.
        if (data.digest?.id) markSeen(data.digest.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [markSeen]);

  const isEmpty = !digest || (top.length === 0 && bytes.length === 0);

  const shownTop = useMemo(() => top.filter((b) => matches(b, filter)), [top, filter]);
  const shownBytes = useMemo(
    () => bytes.filter((b) => matches(b, filter)),
    [bytes, filter],
  );

  // Only offer the filter when the digest actually carries both kinds.
  const hasVideo = useMemo(
    () => [...top, ...bytes].some((b) => b.source === "video"),
    [top, bytes],
  );

  // Sections arrive as a group rather than each card racing in separately.
  const section = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, bounce: 0, duration: 0.4 },
      };

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-3xl mx-auto pb-28 md:pb-10">
      {/* The digest label belongs here, once, rather than repeated on every
          featured row as it was before. */}
      <PageHeader
        title="Bytes"
        subtitle={
          digest
            ? `${digest.label}. Upvote anything you want on the meeting agenda.`
            : "Articles, reporting and talks from the week, worth two minutes."
        }
        /* Only offered when the digest actually carries both kinds. A filter
           with nothing to filter is a control that teaches you it does
           nothing. */
        action={
          !loading && hasVideo ? (
            <FormatFilter value={filter} onChange={setFilter} />
          ) : undefined
        }
      />

      {loading ? (
        <CardSkeleton count={4} />
      ) : isEmpty ? (
        <EmptyState
          icon={Broadcast}
          title="Nothing yet this week"
          body="A fresh digest lands every Monday morning. Upvote anything you want turned into a topic."
        />
      ) : (
        <div className="space-y-(--gap-section)">
          {/* ─── Top: what the guild engaged with most ───
              One bordered group with hairline-separated rows, not a stack of
              floating cards. Dense content reads better as a list, and it stops
              seven stories from occupying four screens. */}
          {shownTop.length > 0 && (
            <motion.section {...section} aria-labelledby="bytes-top">
              <SectionHeader
                id="bytes-top"
                title="Top right now"
                hint="most upvoted for the meet"
              />
              {/* The one lifted surface on the page. This section is ordered by
                  the guild's own upvotes, so it gets a warm edge; everything
                  below is the raw feed and stays neutral.
                  No 1/2/3 numbering: the order already says which is ahead, and
                  each row carries its own upvote count, so the rank column was
                  a third number competing with the two that mean something. */}
              <div className="rounded-(--radius-card) border border-saffron/20 bg-paper/60 divide-y divide-border overflow-hidden">
                {shownTop.map((b) => (
                  <ByteCard key={b.id} byte={b} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── This week's fetch ─── */}
          {shownBytes.length > 0 && (
            <motion.section
              {...section}
              transition={{
                ...section.transition,
                delay: reduceMotion ? 0 : 0.06,
              }}
              aria-labelledby="bytes-week"
            >
              <SectionHeader
                id="bytes-week"
                title={
                  digest?.kind === "weekly"
                    ? "This week"
                    : "Also in this digest"
                }
                hint={`${shownBytes.length} more`}
              />
              <div className="rounded-(--radius-card) border border-border bg-paper/40 divide-y divide-border overflow-hidden">
                {shownBytes.map((b) => (
                  <ByteCard key={b.id} byte={b} />
                ))}
              </div>
            </motion.section>
          )}

          {shownTop.length === 0 && shownBytes.length === 0 && (
            <p className="text-footnote text-ink-muted py-6 text-center">
              Nothing to {filter === "watch" ? "watch" : "read"} in this digest.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
