'use client'

import { ToastProvider } from '@/hooks/useToast'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { PushOptIn } from '@/components/pwa/PushOptIn'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ServiceWorkerRegister />
      <InstallPrompt />
      <PushOptIn />
    </ToastProvider>
  )
}
