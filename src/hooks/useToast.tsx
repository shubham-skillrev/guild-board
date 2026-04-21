'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from 'react-icons/fi'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  emoji?: string
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, emoji?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-matcha/30 bg-matcha-light text-matcha',
  error:   'border-vermillion/30 bg-vermillion-light text-vermillion',
  warning: 'border-saffron/30 bg-saffron-light text-saffron',
  info:    'border-indigo-jp/30 bg-indigo-light text-indigo-jp',
}

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <FiCheck className="w-3.5 h-3.5 shrink-0" />,
  error:   <FiX className="w-3.5 h-3.5 shrink-0" />,
  warning: <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  info:    <FiInfo className="w-3.5 h-3.5 shrink-0" />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, variant: ToastVariant = 'success', emoji?: string) => {
    const id = `t-${++counter.current}`
    setToasts(prev => [...prev, { id, message, variant, emoji }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`
                flex items-center gap-2 px-3.5 py-2.5 rounded-xl
                border text-[12px] font-medium
                shadow-[0_4px_24px_rgba(0,0,0,0.4)]
                backdrop-blur-sm pointer-events-auto
                max-w-[280px]
                ${VARIANT_STYLES[t.variant]}
              `}
            >
              {t.emoji ? (
                <span className="text-base leading-none shrink-0">{t.emoji}</span>
              ) : (
                VARIANT_ICONS[t.variant]
              )}
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
