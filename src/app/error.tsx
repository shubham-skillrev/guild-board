'use client' // Error boundaries must be Client Components

import { Warning } from '@phosphor-icons/react/dist/ssr'
import { EmptyState } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { botSays } from '@/lib/guildbot-host/voice'

export default function Error({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <main className="flex-1 flex items-center justify-center px-(--pad-page-x)">
      <EmptyState
        icon={Warning}
        title="Something went wrong"
        body={botSays('ui.error', 'error', 'ui') ?? 'Something broke on our side. Try again.'}
        action={<Button onClick={() => unstable_retry()}>Try again</Button>}
      />
    </main>
  )
}
