---
target: home
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx"
target_fingerprint: "sha256:eb1217876cdd7770910f40d0dccc3615ea3cc95afc3eba383431e7030a27c370"
target_path: /Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx
timestamp: 2026-09-29T20-15-25Z
slug: src-app-admin-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 26/40 (Acceptable)
| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Franja en curso sin cantidad de jugadores; aparece tarde y empuja la lista |
| 2 | Lenguaje del usuario | 3 | "Sala", "Lanzar en vivo" bien; login "Admin" genérico |
| 3 | Control y libertad | 3 | No se puede terminar/descartar una sala abandonada desde el home |
| 4 | Consistencia | 2 | role=alert en un confirm y no en el otro; signOut local vs global; orden de Tab del header ≠ visual |
| 5 | Prevención de errores | 3 | Se puede lanzar otra partida con una en curso sin aviso |
| 6 | Reconocer antes que recordar | 3 | Meta con preguntas y fecha |
| 7 | Flexibilidad | 1 | Sin búsqueda/orden/duplicar |
| 8 | Estética | 3 | Con partidas en curso hay 5 amarillos + bordes amarillos |
| 9 | Recuperación de errores | 3 | Fallback "Algo salió mal" al lanzar |
| 10 | Ayuda | 2 | Pantalla sin permisos sin próximo paso |

## Especificidad
Marca aplicada pero estructura intercambiable; la franja "Partidas en curso" y la línea sobre el lanzamiento son lo más específico. Detector: 0 en CLI; en navegador 1 (line-length en page.tsx:237, desktop) — probable falso positivo (una sola línea).

## Priority Issues
1. [P1] Confirmación de "Cerrar sesión" rompe el header en desktop (page.tsx:106,224): Cancelar huérfano, Nuevo quiz baja, la página salta ~150px. Fix: banner de ancho completo bajo el header. → layout
2. [P1] Franja en curso solo recupera: sin Terminar, sin jugadores, sin aviso al lanzar con partida activa; aparece tarde (page.tsx:31,55,179). → harden
3. [P2] Lector/teclado: confirm de borrado sin rol/etiqueta (solo "Cancelar"), orden de Tab del header invertido (page.tsx:222), "Volver a la sala" sin fase. → audit
4. [P2] Textos en momentos críticos: fallback genérico al lanzar, pantalla sin permisos sin h1 ni guía y signOut global, anillo amarillo sobre error rojo. → clarify
5. [P3] Amarillo de más y títulos invertidos ("Partidas en curso" 1.25rem vs "Quizzes" 2em). → quieter + typeset

## Persona Red Flags
- Alex: sin búsqueda/duplicar; 7 Tabs hasta el primer Lanzar; no puede cerrar una sala vieja.
- Sam: confirm de borrado anunciado como "Cancelar" a secas; orden de Tab invertido; sin encabezado en pantalla sin permisos.
- Staff: email y confirm de salida visibles al público si se duplica; partidas de otro admin invisibles (y host_advance exige ser el host); sin vista previa de lo que se va a proyectar.

## Minor
- Login sin autofocus en Email.
- Fechas "20 sept" vs "1 de ago de 2025" (formato de Intl es-AR).
- Error de lanzar queda lejos del botón en desktop.

## Questions
1. ¿Estado "apto para proyector" sin email ni borrar?
2. ¿Las partidas en curso deberían ser del evento y no del admin?
3. ¿Cómo sería un home de "día de evento"?
