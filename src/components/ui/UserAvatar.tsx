'use client'

import Avatar from 'boring-avatars'

interface UserAvatarProps {
  username: string
  size?: number
  className?: string
}

const PALETTE = ['#E8913A', '#3DB88A', '#5B8DEF', '#9A7BD4', '#E85D75']

export function UserAvatar({ username, size = 28, className }: UserAvatarProps) {
  return (
    <div className={className} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <Avatar
        size={size}
        name={username}
        variant="beam"
        colors={PALETTE}
      />
    </div>
  )
}
