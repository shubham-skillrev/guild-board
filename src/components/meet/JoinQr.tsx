'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'

/** This site's origin, after mount (the server render has none). */
export function useOrigin(): string {
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setOrigin(window.location.origin), 0)
    return () => clearTimeout(id)
  }, [])
  return origin
}

/**
 * A QR code for a path on this site, scannable from a shared screen: black on
 * a white card with a quiet zone in light and dark alike, and the short link
 * under it with a small Copy button.
 */
export function JoinQr({ path, size = 240, caption, className }: { path: string; size?: number; caption?: string; className?: string }) {
  const toast = useToast()
  const origin = useOrigin()
  const link = origin ? `${origin}${path}` : ''
  const short = link.replace(/^https?:\/\//, '')
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => toast('Link copied', 'success'), () => toast('Copy it by hand', 'error'))
  }
  return (
    <figure className={cn('flex flex-col items-center gap-3', className)}>
      <div className="rounded-[20px] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]" style={{ width: size + 32, height: size + 32 }}>
        {link && <QRCodeSVG value={link} size={size} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" title={caption ?? 'Scan to open'} />}
      </div>
      {caption && <figcaption className="text-[17px] font-medium text-ink">{caption}</figcaption>}
      <div className="flex items-center gap-1">
        <span className="font-mono text-[14px] text-ink-soft select-all">{short}</span>
        <Button variant="ghost" icon={Copy} onClick={copy} disabled={!link} aria-label="Copy link" />
      </div>
    </figure>
  )
}
