"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Broadcast } from "@phosphor-icons/react";
import { ByteCard, type Byte } from "@/components/bytes/ByteCard";
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

export default function BytesPage() {
  const reduceMotion = useReducedMotion();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [top, setTop] = useState<Byte[]>([]);
  const [bytes, setBytes] = useState<Byte[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bytes")
      .then((r) => r.json())
      .then((data) => {
        setDigest(data.digest ?? null);
        setTop(Array.isArray(data.top) ? data.top : []);
        setBytes(Array.isArray(data.bytes) ? data.bytes : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isEmpty = !digest || (top.length === 0 && bytes.length === 0);

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
            ? `${digest.label}. Tap anything you want on the board.`
            : "What happened in tech, worth two minutes of your week."
        }
      />

      {loading ? (
        <CardSkeleton count={4} />
      ) : isEmpty ? (
        <EmptyState
          icon={Broadcast}
          title="Nothing yet this week"
          body="A fresh digest lands every Monday morning. Tap the discuss icon on anything you want turned into a topic."
        />
      ) : (
        <div className="space-y-(--gap-section)">
          {/* ─── Top: what the guild engaged with most ───
              One bordered group with hairline-separated rows, not a stack of
              floating cards. Dense content reads better as a list, and it stops
              seven stories from occupying four screens. */}
          {top.length > 0 && (
            <motion.section {...section} aria-labelledby="bytes-top">
              <SectionHeader
                id="bytes-top"
                title="Top right now"
                hint="most wanted for discussion"
              />
              {/* The one lifted surface on the page. This section is ranked by
                  the guild's own taps, so it gets a warm edge; everything below
                  is the raw feed and stays neutral. */}
              <div className="rounded-(--radius-card) border border-saffron/20 bg-paper/60 divide-y divide-border overflow-hidden">
                {top.map((b, i) => (
                  <ByteCard key={b.id} byte={b} rank={i + 1} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── This week's fetch ─── */}
          {bytes.length > 0 && (
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
                hint={`${bytes.length} more`}
              />
              <div className="rounded-(--radius-card) border border-border bg-paper/40 divide-y divide-border overflow-hidden">
                {bytes.map((b) => (
                  <ByteCard key={b.id} byte={b} />
                ))}
              </div>
            </motion.section>
          )}
        </div>
      )}
    </div>
  );
}
