---
version: 1
slug: "src-app-admin-layout-tsx"
primary_target: "src/app/(admin)/layout.tsx"
related_targets: []
---

# Login de anfitriones

Scope: pantalla de acceso del admin (`(admin)/layout.tsx`: login, cargando, sin permisos). Primer paso del rediseño total. Mode: Operate, con el juego por delante.

Audiencia: el equipo de OPSA que arma y conduce quizzes en eventos de clientes. Tarea: entrar con email y contraseña en segundos. Restricciones: auth Supabase sin cambios; voseo; AA.

## Direction contract

THESIS: El quiz es una planilla de calcomanías troqueladas de New Holland: mascotas, tarjeta y botón están pegados sobre un campo azul. Rechaza el login centrado en tarjeta gris sobre fondo oscuro que muestra cualquier panel.

OWN-WORLD: Campo azul New Holland saturado a toda pantalla; todo lo que importa es un sticker de vinilo con borde blanco grueso, esquinas redondeadas, leve rotación y sombra de despegue suave. Amarillo NH solo en la acción y en el título. Display redonda y pesada (Lilita One), UI en Rubik. Sin grises: los secundarios se tiñen de azul.

STORY: El anfitrión reconoce al instante el quiz de New Holland, se ríe con las mascotas y entra sin pensar.

FIRST VIEWPORT: Desktop: tarjeta navy de 440px centrada, girada -1°, con logo, «¡Armá el quiz!» en amarillo, bajada, email, contraseña y «Entrar» amarillo a todo el ancho; cuatro mascotas-sticker en las esquinas del campo. Mobile: solo las dos de arriba (150px), la tarjeta ocupa el ancho.

FORM: Calcomanía troquelada, candidata 1 de mi lista (pick), seed f9c6ef6b. Interacción firma: los stickers se «pegan» en secuencia al cargar (caen, aprietan, se asientan); el error llega como una etiqueta roja pegada sobre la tarjeta.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
