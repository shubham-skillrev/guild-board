// ROUTE: /meet/mock (dev only: 404 in production)
// PURPOSE: Meeting mode on fake data, to see and tweak its screens without a
//          live meeting or a database. The real PresenterView, MeetRoom,
//          banner and board card, switched by URL params (see MeetMock.tsx
//          and data.ts). Nothing is fetched or written.

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MeetMock } from './MeetMock'

export const metadata: Metadata = { title: 'Meeting mock' }

export default function MeetMockPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense>
      <MeetMock />
    </Suspense>
  )
}
