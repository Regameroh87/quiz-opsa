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
    // También los hijos directos: lo que desborda una fila con alto propio (flex-1) no siempre cuenta
    // en el scroll de la pantalla y se comería el margen de abajo.
    const overflows = (el: Element) => el.scrollHeight > el.clientHeight + 1
    const fits = (k: number) => {
      apply(box, k)
      return !overflows(box) && !Array.from(box.children).some(overflows)
    }
    const search = () => {
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
    // Se mide sin transforms (ver data-fit-measuring en globals.css): la animación de entrada agranda los
    // stickers y, medida a mitad de camino, hacía creer que no entraban. Se saca en el mismo frame: no se ve.
    const fit = () => {
      box.setAttribute('data-fit-measuring', '')
      try {
        search()
      } finally {
        box.removeAttribute('data-fit-measuring')
      }
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
