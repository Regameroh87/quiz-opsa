'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export const MENU_ITEM = 'flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-white hover:bg-white/10 focus-visible:bg-white/10'

/** Menú "Más" de una fila de lista: junta las acciones secundarias para que la principal sea lo único a la vista. */
export default function RowMenu({ label, autoFocus, disabled, children }: {
  label: string
  autoFocus?: boolean
  disabled?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Abierto: se cierra al tocar afuera y con Escape (el foco vuelve al botón).
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

  return (
    <div ref={root} className="relative">
      <button ref={trigger} type="button" className="quiet-link" autoFocus={autoFocus} disabled={disabled}
        aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Más
      </button>
      {open && (
        <div id={id} className="absolute right-0 top-full z-20 mt-2 flex w-44 flex-col gap-1 rounded-[20px] border-4 border-white bg-navy p-2 shadow-[0_8px_0_rgb(0_20_60/0.4),0_16px_26px_-8px_rgb(0_0_0/0.3)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
