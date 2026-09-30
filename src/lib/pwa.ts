'use client'

import { useSyncExternalStore } from 'react'

// Instalación de la PWA, compartida por el aviso flotante (PwaInstallPrompt) y el menú de la cuenta.
// El navegador dispara `beforeinstallprompt` una sola vez por carga: se guarda acá para que cualquiera pueda usarlo.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
// En iPhone no hay instalación por código: se muestra la guía de "Agregar a pantalla de inicio".
let iosGuide = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', emit)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

const isIos = () => {
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) && !/crios/.test(ua)
}

/** Si se puede instalar ahora (y no está ya instalada), y si hay que mostrar la guía de iPhone. */
export function usePwaInstall() {
  const canInstall = useSyncExternalStore(subscribe, () => !isStandalone() && (!!deferred || isIos()), () => false)
  const showIosGuide = useSyncExternalStore(subscribe, () => iosGuide, () => false)
  return { canInstall, showIosGuide }
}

/** Abre el diálogo de instalación del navegador o, en iPhone, la guía paso a paso. */
export async function installPwa() {
  if (deferred) {
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') deferred = null
    emit()
  } else if (isIos()) {
    iosGuide = true
    emit()
  }
}

export function closeIosGuide() {
  iosGuide = false
  emit()
}
