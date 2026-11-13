'use client'

import { useState } from 'react'
import { SlackLogo, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/Section'
import { useMeeting } from '@/components/admin/run/useMeeting'
import { LIMITS, type Meeting } from '@/lib/meeting'
import { ReportButton } from '@/components/meet/ReportButton'
import { rehearsalOn } from '@/lib/meet/liveRehearsal'

/**
 * After the meeting: Kers drafts the recap from what was captured (agenda,
 * notes and decisions, topic outcomes, Show & Tell), you add the recording
 * and fix the words, and it goes to Slack for everyone who missed it.
 */
export function RecapPanel({ initial }: { initial: Meeting }) {
  const { meeting, busy, call } = useMeeting(initial)
  const [recap, setRecap] = useState(initial.recap ?? '')
  const [recording, setRecording] = useState(initial.recordingUrl ?? '')
  const dirty = recap !== (meeting.recap ?? '') || recording !== (meeting.recordingUrl ?? '')

  const draft = async () => {
    const data = await call<{ recap: string; byAi: boolean }>('draft_recap')
    if (data?.recap) setRecap(data.recap)
  }

  return (
    <section aria-labelledby="run-recap" className="space-y-3">
      <SectionHeader
        id="run-recap"
        title="Recap"
        hint={meeting.recapPostedAt ? `Posted to Slack ${new Date(meeting.recapPostedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : meeting.endedAt ? 'The meeting’s over: tell everyone who missed it' : 'After the meeting'}
      />
      <Button variant="secondary" icon={Sparkle} className="w-full" disabled={!!busy} onClick={draft}>
        {busy === 'draft_recap' ? 'Kers is writing…' : recap ? 'Redraft with Kers' : 'Draft with Kers'}
      </Button>
      <div>
        <Label htmlFor="run-recap-text">Recap</Label>
        <Textarea id="run-recap-text" rows={7} maxLength={LIMITS.recap} value={recap} onChange={e => setRecap(e.target.value)} className="font-sans text-footnote" placeholder="Thanks, who presented, decisions and owners, what's next." />
        {recap.length > LIMITS.recap * 0.8 && <p className="mt-1 text-right text-meta text-ink-muted tabular">{recap.length}/{LIMITS.recap}</p>}
      </div>
      <div>
        <Label htmlFor="run-recording">Recording link</Label>
        <Input id="run-recording" type="url" placeholder="https://drive.google.com/…" value={recording} onChange={e => setRecording(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={dirty ? 'primary' : 'secondary'} disabled={!!busy || !dirty} onClick={() => call('save', { recap, recording_url: recording }, 'Recap saved')}>
          {busy === 'save' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </Button>
        <Button variant="secondary" icon={SlackLogo} disabled={!!busy || dirty || !meeting.recap} onClick={() => call('post_recap', {}, 'Recap posted to Slack')}>
          {busy === 'post_recap' ? 'Posting…' : meeting.recapPostedAt ? 'Post again' : 'Post to Slack'}
        </Button>
      </div>
      {/* The anonymous report image for Slack: only once the real meeting has ended (never a rehearsal's answers). */}
      {meeting.endedAt && !rehearsalOn(meeting) && <ReportButton cycleId={meeting.cycleId} />}
    </section>
  )
}
