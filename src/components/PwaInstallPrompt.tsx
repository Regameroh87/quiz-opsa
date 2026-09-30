'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getStandaloneSnapshot() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone))
  )
}

function getServerFalse() {
  return false
}

function getIosSnapshot() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) && !/crios/.test(ua)
}

function getSessionDismissedSnapshot() {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('pwa_prompt_dismissed') === 'true'
}

export default function PwaInstallPrompt() {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerFalse
  )

  const isIos = useSyncExternalStore(
    () => () => {},
    getIosSnapshot,
    getServerFalse
  )

  const isSessionDismissed = useSyncExternalStore(
    () => () => {},
    getSessionDismissedSnapshot,
    getServerFalse
  )

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Capturar evento de instalación estándar (Chrome, Android, Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else if (isIos) {
      setShowIosGuide(true)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowIosGuide(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true')
    }
  }

  if (isStandalone || isSessionDismissed || dismissed) {
    return null
  }

  // Si no hay prompt nativo disponible ni es iOS, no mostramos nada
  if (!deferredPrompt && !isIos) {
    return null
  }

  return (
    <>
      {/* Banner / Píldora de Instalación */}
      <div className="fixed bottom-3 left-4 right-4 z-40 mx-auto max-w-[500px]">
        <div className="flex items-center justify-between gap-3 rounded-card border-2 border-brand bg-surface p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-brand text-brand-contrast">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-text">Instalar Quiz New Holland</span>
              <span className="text-xs text-muted">Accedé más rápido y a pantalla completa</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-[8px] bg-brand px-3.5 py-2 text-xs font-bold text-brand-contrast shadow transition hover:opacity-95 cursor-pointer"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar aviso de instalación"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-text cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Modal explicativo para usuarios de iOS / Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 pb-8 sm:items-center">
          <div className="card w-full max-w-sm gap-4 border-2 border-brand bg-surface p-5 text-center shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-text">Cómo instalar en iPhone / iPad</h2>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-muted hover:text-text cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
                  1
                </span>
                <span>
                  Tocá el botón <strong>Compartir</strong>{' '}
                  <span className="inline-block px-1 font-bold">
                    <svg
                      className="inline h-4 w-4 align-text-bottom"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </span>{' '}
                  en la barra inferior de Safari.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
                  2
                </span>
                <span>
                  Buscá y seleccioná <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
                  3
                </span>
                <span>Tocá <strong>&quot;Agregar&quot;</strong> en la esquina superior derecha.</span>
              </div>
            </div>
            <button
              type="button"
              className="btn w-full mt-2"
              onClick={() => setShowIosGuide(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
