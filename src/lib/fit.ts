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
    // Se compara con las cajas y no con scrollHeight: un título con interlineado apretado "desborda" con la
    // tinta de las letras y parecía no entrar nunca. Dos niveles: los bloques de la pantalla dentro de su
    // padding, y lo de adentro de cada bloque (una fila flex-1 con alto propio) dentro del bloque.
    const inFlow = (el: Element) => !['fixed', 'absolute'].includes(getComputedStyle(el).position)
    const spills = (parent: Element, top: number, bottom: number) => Array.from(parent.children).some((c) => {
      if (!inFlow(c)) return false
      const r = c.getBoundingClientRect()
      return r.height > 0 && (r.top < top - 1 || r.bottom > bottom + 1)
    })
    const fits = (k: number) => {
      apply(box, k)
      const r = box.getBoundingClientRect()
      const css = getComputedStyle(box)
      if (spills(box, r.top + parseFloat(css.paddingTop), r.bottom - parseFloat(css.paddingBottom))) return false
      return !Array.from(box.children).some((c) => {
        if (!inFlow(c)) return false
        const cr = c.getBoundingClientRect()
        return spills(c, cr.top, cr.bottom)
      })
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
