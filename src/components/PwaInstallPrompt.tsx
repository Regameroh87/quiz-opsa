'use client'

import { useState, useSyncExternalStore } from 'react'
import { closeIosGuide, installPwa, usePwaInstall } from '@/lib/pwa'

// Cerrado en esta sesión: no vuelve a aparecer hasta abrir de nuevo el navegador (sigue en el menú de la cuenta).
function getSessionDismissedSnapshot() {
  try {
    return sessionStorage.getItem('pwa_prompt_dismissed') === 'true'
  } catch {
    return false
  }
}

export default function PwaInstallPrompt() {
  const { canInstall, showIosGuide } = usePwaInstall()
  const isSessionDismissed = useSyncExternalStore(() => () => {}, getSessionDismissedSnapshot, () => false)
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true')
    } catch {}
  }

  const showBanner = canInstall && !isSessionDismissed && !dismissed

  return (
    <>
      {/* Banner / Píldora de Instalación */}
      {showBanner && (
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
              onClick={() => void installPwa()}
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
      )}

      {/* Modal explicativo para usuarios de iOS / Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 pb-8 sm:items-center">
          <div className="card w-full max-w-sm gap-4 border-2 border-brand bg-surface p-5 text-center shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-text">Cómo instalar en iPhone / iPad</h2>
              <button
                type="button"
                onClick={closeIosGuide}
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
              onClick={closeIosGuide}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
