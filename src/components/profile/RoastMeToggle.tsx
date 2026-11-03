import { ProfileSwitch } from '@/components/profile/ProfileSwitch'

/**
 * Let GuildBot tease you by name. Off by default. The bot only does it in
 * comments on your own posts and replies in the app, never in Slack, never
 * on a post you made as a ghost, and never about work or pay.
 */
export function RoastMeToggle({ initial }: { initial: boolean }) {
  return (
    <ProfileSwitch
      initial={initial}
      endpoint="/api/profile/roast-me"
      field="roast_me"
      label="Let GuildBot tease me by name"
      hint="Only on your own posts and replies in the app. Never in Slack, never on a ghost post, never about work."
    />
  )
}
