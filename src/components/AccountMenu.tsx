'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { installPwa, usePwaInstall } from '@/lib/pwa'
import { MENU_ITEM as ITEM } from '@/components/RowMenu'

/** Avatar de la cuenta (inicial del mail) con un menú: datos de la sesión, gestión de socios (admin), contraseña, instalar la app y salir. */
export default function AccountMenu({ email, isAdmin, onSignOut, autoFocus }: {
  email: string
  isAdmin: boolean
  onSignOut: () => void
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Solo si el navegador permite instalarla y todavía no está instalada.
  const { canInstall } = usePwaInstall()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Abierto: se cierra al tocar afuera y con Escape (el foco vuelve al avatar).
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={root} className="relative z-20">
      <button ref={trigger} autoFocus={autoFocus} type="button" aria-label="Cuenta" aria-expanded={open} aria-controls="account-menu"
        className="grid size-11 place-items-center rounded-full border-[3px] border-white bg-brand font-display text-lg leading-none text-brand-contrast shadow-[0_4px_0_#b3830a] active:translate-y-[3px] active:shadow-[0_1px_0_#b3830a]"
        onClick={() => setOpen((o) => !o)}>
        {email ? email[0].toUpperCase() : '·'}
      </button>
      {open && (
        <div id="account-menu" className="absolute right-0 top-full mt-3 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-[20px] border-4 border-white bg-navy p-2 shadow-[0_8px_0_rgb(0_20_60/0.4),0_16px_26px_-8px_rgb(0_0_0/0.3)]">
          <p className="break-all border-b border-white/20 px-3 pb-2 pt-1 text-sm text-ink-soft">{email}</p>
          {isAdmin && <Link className={ITEM} href="/socios" transitionTypes={['nav-forward']} onClick={close}>Socios</Link>}
          <Link className={ITEM} href="/cuenta" transitionTypes={['nav-forward']} onClick={close}>Cambiar contraseña</Link>
          {canInstall && <button type="button" className={ITEM} onClick={() => { close(); void installPwa() }}>Instalar app</button>}
          <button type="button" className={ITEM} onClick={() => { close(); onSignOut() }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  )
}
