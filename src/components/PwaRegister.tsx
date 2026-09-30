'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getServerOnlineSnapshot() {
  return true
}

export default function PwaRegister() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  )
  const isOffline = !isOnline

  const [showUpdate, setShowUpdate] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
          setShowUpdate(true)
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker)
                setShowUpdate(true)
              }
            })
          }
        })
      } catch (err) {
        console.error('[PWA] Error registrando Service Worker:', err)
      }
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      return () => window.removeEventListener('load', registerSW)
    }
  }, [])

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    setShowUpdate(false)
    window.location.reload()
  }

  return (
    <>
      {/* Banner de alerta sin conexión */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-[#ff6b6b] px-4 py-2 text-center text-xs font-bold text-black shadow-md transition-all"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a5 5 0 010-7.072m-4.243-4.243a9 9 0 0112.728 0M3 3l18 18"
            />
          </svg>
          <span>Estás en modo sin conexión. Algunas funciones en tiempo real no responderán.</span>
        </div>
      )}

      {/* Notificación de actualización de la PWA */}
      {showUpdate && (
        <div
          role="alert"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 flex max-w-sm items-center justify-between gap-3 rounded-card border-2 border-brand bg-surface p-4 shadow-xl"
        >
          <div className="flex flex-col text-left">
            <span className="font-bold text-sm text-text">Nueva versión disponible</span>
            <span className="text-xs text-muted">Actualizá para recibir las últimas mejoras.</span>
          </div>
          <button
            type="button"
            onClick={handleUpdate}
            className="rounded-[8px] bg-brand px-3 py-1.5 text-xs font-bold text-brand-contrast hover:opacity-90 cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      )}
    </>
  )
}
