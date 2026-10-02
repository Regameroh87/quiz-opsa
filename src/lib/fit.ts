import { useCallback } from 'react'

/**
 * Achica una pantalla de alto fijo hasta que su contenido entre sin scroll: busca la escala más grande
 * (entre min y 1) con la que `box` no desborda. Cómo se achica lo decide `apply` (zoom, tamaño de letra…).
 * Se recalcula cuando cambia la pantalla, el contenido (otra fase, el temporizador) o termina de cargar
 * una imagen o una fuente. Si ni con `min` entra, queda en `min`.
 *
 * Devuelve una ref de callback: se engancha cuando el elemento aparece, aunque antes se haya mostrado
 * otra cosa (Cargando…). `apply` tiene que ser estable (definida fuera del componente).
 */
export function useFitHeight(apply: (box: HTMLElement, scale: number) => void, min: number) {
  return useCallback((box: HTMLElement | null) => {
    if (!box) return
    const fits = (k: number) => {
      apply(box, k)
      return box.scrollHeight <= box.clientHeight + 1
    }
    const fit = () => {
      if (fits(1)) return
      let lo = min
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
      fits(lo)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    // El estilo que pone `apply` no es un cambio de contenido: sin attributes no se dispara solo.
    const mo = new MutationObserver(fit)
    mo.observe(box, { subtree: true, childList: true, characterData: true })
    box.addEventListener('load', fit, true) // imágenes (load no burbujea: se escucha en captura)
    let alive = true
    void document.fonts.ready.then(() => alive && fit())
    return () => {
      alive = false
      ro.disconnect()
      mo.disconnect()
      box.removeEventListener('load', fit, true)
    }
  }, [apply, min])
}
