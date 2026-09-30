'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = () => {
    setRetrying(true)
    if (typeof window !== 'undefined') {
      if (navigator.onLine) {
        window.location.reload()
      } else {
        setTimeout(() => {
          setRetrying(false)
        }, 1200)
      }
    }
  }

  return (
    <main className="page items-center justify-center text-center">
      <div className="mb-2">
        <Logo height={48} />
      </div>

      <div className="card w-full max-w-[420px] items-center gap-5 p-6 text-center shadow-2xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface/80 border-2 border-line text-brand">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-brand"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a5 5 0 010-7.072m-4.243-4.243a9 9 0 0112.728 0M3 3l18 18"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Sin conexión a internet
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Las trivias y salas en vivo requieren conexión de red para sincronizar preguntas y puntajes en tiempo real.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 pt-2">
          <button
            type="button"
            className="btn w-full flex items-center justify-center gap-2"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin text-brand-contrast"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Comprobando conexión…</span>
              </>
            ) : (
              <span>Reintentar conexión</span>
            )}
          </button>

          <Link href="/" className="btn-outline w-full block">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
