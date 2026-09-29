---
target: home
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx"
target_fingerprint: "sha256:f28259c1c4220ce5e3a8793587453eeed403cf5593055d7e318ac86f502b4ab9"
target_path: /Users/rodrigogamero/Desktop/quiz-opsa/src/app/(admin)/page.tsx
timestamp: 2026-09-29T19-16-19Z
slug: src-app-admin-page-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 19/40 (Poor)
| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 1 | Sin estado pendiente en "Lanzar en vivo", "Entrar", "Borrar"; carga inicial en blanco |
| 2 | Correspondencia con el mundo real | 3 | Voseo bien; "Admin"/"Quizzes" fríos, nada habla de "evento" |
| 3 | Control y libertad | 2 | Sin "Cerrar sesión" ni usuario visible en la lista; sin deshacer al borrar |
| 4 | Consistencia | 3 | Primitivas consistentes; confirm() nativo rompe el estilo |
| 5 | Prevención de errores | 1 | Doble clic en Lanzar crea partidas duplicadas; Borrar con el mismo peso que Editar |
| 6 | Reconocer antes que recordar | 2 | Tarjetas solo con título; created_at se trae y no se muestra |
| 7 | Flexibilidad y eficiencia | 1 | Sin búsqueda/orden/filtro "mis quizzes" |
| 8 | Estética minimalista | 3 | Limpio, pero N+1 botones amarillos idénticos |
| 9 | Recuperación de errores | 2 | Error de lanzar genérico y lejos de la tarjeta; error de carga se muestra como "no hay quizzes" |
| 10 | Ayuda | 1 | Estado vacío sin CTA ni guía |

## Especificidad
Marca presente (logo, navy, amarillo FieldOps, voseo) pero estructura genérica: login centrado estándar y lista CRUD de 560px sin logo, encabezado ni sentido de evento. Detector: 0 hallazgos (CLI y navegador, desktop y mobile).

## Priority Issues
1. [P1] "Lanzar en vivo" sin estado pendiente ni bloqueo (page.tsx:21-29,51): doble clic = partidas duplicadas; error arriba de todo. Fix: launchingId, deshabilitar, "Abriendo sala…", error en la tarjeta. → harden
2. [P1] Estados de carga/error (page.tsx:16-18,46): carga en blanco; un error de Supabase se ignora y se muestra "Todavía no hay quizzes". Fix: Cargando…, error con Reintentar, vacío con CTA. → harden
3. [P1] Jerarquía: N+1 CTAs amarillos, Borrar al mismo peso (page.tsx:43,51-53). Fix: un solo Lanzar fuerte por tarjeta, Editar/Borrar discretos, Borrar con tratamiento de peligro y confirmación propia. → layout
4. [P2] Tarjetas sin datos para elegir con confianza (page.tsx:49): cantidad de preguntas, fecha, autor, si ya se jugó. → clarify
5. [P2] Sin encabezado de marca, usuario ni "Cerrar sesión" en la lista, con varios admins en la misma notebook. → layout

## Persona Red Flags
- Alex: sin búsqueda ni atajos; "Entrar" sin pending (doble envío).
- Sam: inputs del login solo con placeholder; borde del input ~1.2:1 sobre la tarjeta (falla 1.4.11); botones "Lanzar/Editar/Borrar" sin nombre del quiz; lista no es <ul>.
- Staff en el evento: si la notebook se duplica al proyector, el público ve el admin; nada confirma qué se lanza ni que tenga preguntas; columna de 560px en pantalla grande se ve inacabada.

## Minor
- "Admin" como título del login es genérico; el error del login mueve todo el bloque.
- Borrar muestra "ya se usó en una partida" ante cualquier error, no solo ese.
- Títulos largos sin break-words.
- El logo dice "OSCAR POURTAU" y PRODUCT.md dice "OPSA": confirmar.

## Questions
1. ¿El home debería ser una "consola del evento" con el quiz de hoy primero y la biblioteca abajo?
2. ¿Lanzar debería abrir el host en otra ventana/pantalla completa para que el público no vea el admin?
3. ¿Hace falta poder borrar desde el home?
