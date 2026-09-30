'use client'

import { ViewTransition } from 'react'

/**
 * Envuelve el contenido de un page.tsx (no de un layout: los layouts persisten y nunca disparan enter/exit).
 * Los links y router.push con transitionTypes=['nav-forward' | 'nav-back'] deslizan la pantalla;
 * cualquier otra navegación (replace, atrás del navegador) hace un fundido suave.
 * Los estilos están en globals.css.
 */
const NAV = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'page-fade' } as const

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={NAV} exit={NAV} default="none">
      {children}
    </ViewTransition>
  )
}
