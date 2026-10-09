import Link from 'next/link'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import { EmptyState } from '@/components/ui/Section'
import { botSays } from '@/lib/guildbot-host/voice'

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-(--pad-page-x)">
      <EmptyState
        icon={MagnifyingGlass}
        title="Page not found"
        body={botSays('ui.not_found', 'not-found', 'ui') ?? "There's nothing at this address."}
        action={
          <Link href="/board" className="text-callout text-saffron hover:underline">
            Back to the board
          </Link>
        }
      />
    </main>
  )
}
