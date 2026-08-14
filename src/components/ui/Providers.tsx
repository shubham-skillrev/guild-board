'use client'

import { ToastProvider } from '@/hooks/useToast'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { PushOptIn } from '@/components/pwa/PushOptIn'
import { OverlaySlotProvider } from '@/components/ui/OverlaySlot'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <OverlaySlotProvider>
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
        <PushOptIn />
      </OverlaySlotProvider>
    </ToastProvider>
  )
}
