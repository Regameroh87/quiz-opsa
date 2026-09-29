---
target: home
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx"
target_fingerprint: "sha256:e414c9d839d0f29dd0b0f373ff8f7329853ca1b30ab87dba957602992cc16834"
target_path: /Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx
timestamp: 2026-09-29T19-38-52Z
slug: src-app-admin-page-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 21/40 (Acceptable)
| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | No muestra usuario logueado ni partidas en curso |
| 2 | Lenguaje del usuario | 3 | "Lanzar en vivo"/"Abriendo sala…" bien; "Quizzes"/"Admin" genéricos |
| 3 | Control y libertad | 2 | Sin Cerrar sesión; sin forma de volver a una partida en curso; Escape pierde el foco |
| 4 | Consistencia | 3 | Primitivas coherentes; QUIET/DANGER fuera del sistema |
| 5 | Prevención de errores | 2 | Quiz sin preguntas se descubre al lanzar |
| 6 | Reconocer antes que recordar | 2 | Filas solo con título |
| 7 | Flexibilidad | 1 | Sin búsqueda/orden/atajos/duplicar |
| 8 | Estética | 3 | Limpio; secundarias bien calladas |
| 9 | Recuperación de errores | 2 | "El quiz no tiene preguntas." sin camino a Editar |
| 10 | Ayuda | 1 | Nada explica qué pasa al lanzar |

## Especificidad
CRUD genérico con piel New Holland; el copy aporta más que el layout. Detector: 0 hallazgos (CLI + navegador, login y lista, desktop y mobile).

## Priority Issues
1. [P1] Sin camino de vuelta a una partida en curso (page.tsx:15): si se cierra la pestaña del host, solo queda el historial. Fix: franja "Partida en curso" con "Volver a la sala". → harden + layout
2. [P1] Notebook compartida sin identidad ni Cerrar sesión (layout.tsx:29). → clarify
3. [P1] Preparación invisible hasta lanzar: mostrar "N preguntas · fecha", deshabilitar Lanzar con 0 preguntas + link a Editar; error con link a Editar y foco. → harden + clarify
4. [P2] N botones amarillos iguales; separador de filas 1.15:1 invisible (page.tsx:105,134). → layout
5. [P2] Foco se pierde tras Escape/Cancelar y tras error de lanzar. → polish

## Persona Red Flags
- Alex: sin búsqueda/orden/duplicar; created_at se trae y no se muestra.
- Sam: 3 "Lanzar en vivo" iguales (el título va solo en aria-describedby); foco perdido; "Cargando…" del layout sin role=status.
- Staff en el evento: si se duplica pantalla, el público ve el admin; error de 16px ilegible desde lejos; dos títulos "Lanzamiento…" se confunden.

## Minor
- Login "Admin" genérico; sin "olvidé mi contraseña".
- Estado forbidden sin logo ni email rechazado.
- Doble "Cargando…"; confirmación de borrado mueve la fila ~4px; Lanzar en la fila en confirmación cancela en silencio; la confirmación no nombra el quiz.
- Tipografía de sistema; la guía NH probablemente define una.

## Questions
1. ¿El home debería abrir con el quiz del evento de hoy?
2. Si la pestaña del host muere a mitad de pregunta, ¿qué se clickea para recuperar la sala?
3. ¿Hace falta un "modo presentación" para que el público nunca vea el admin?
