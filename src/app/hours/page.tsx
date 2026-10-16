// ROUTE: /hours (public, no login)
// PURPOSE: "The guild building, every hour of the day": SkillRev's entry in
//          the ".wtf" trend (chaitapri.wtf, saloon.wtf). A story, not a
//          dashboard: no live guild data, ever. ?h=<scene> opens one hour
//          (and shares with that hour's preview card).

import type { Metadata } from 'next'
import { HoursPage } from '@/components/hours/HoursPage'
import { sceneBySlug } from '@/lib/hours/scenes'

type Props = { searchParams: Promise<{ h?: string | string[] }> }

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://guildboard.skillrev.in'

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const h = (await searchParams).h
  const scene = sceneBySlug(typeof h === 'string' ? h : null)
  const title = scene ? `The guild building at ${scene.name.toLowerCase()}` : 'The guild building, every hour of the day'
  const description = 'One building, every hour of the day. Lit windows, a chai cart, and GuildBot in the shop window. From the SkillRev guild.'
  const image = `/hours/og${scene ? `?h=${scene.slug}` : ''}`
  return {
    metadataBase: new URL(SITE),
    title: { absolute: title },
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function Page({ searchParams }: Props) {
  const h = (await searchParams).h
  return <HoursPage initialSlug={sceneBySlug(typeof h === 'string' ? h : null)?.slug ?? null} />
}
