---
name: Quiz New Holland
description: Planilla de calcomanías troqueladas de New Holland pegadas sobre un campo azul.
colors:
  field: "#1b4fc9"
  navy: "#00205b"
  brand: "#f1b514"
  brand-contrast: "#000000"
  ink-soft: "#c9d8ff"
  sticker-white: "#ffffff"
  alert: "#d7263d"
  opt-0: "#c9302c"
  opt-1: "#2f6fe0"
  opt-2: "#b45309"
  opt-3: "#15803d"
typography:
  display:
    fontFamily: "Bowlby One, Rubik, system-ui, sans-serif"
    fontSize: "clamp(44px, 6vw, 64px)"
    fontWeight: 400
    lineHeight: 0.95
  status:
    fontFamily: "Bowlby One, Rubik, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1.1
  lead:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  input:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 500
  button:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 900
  label:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  tag: "14px"
  input: "16px"
  button: "18px"
  tile: "28px"
  card: "36px"
spacing:
  xs: "6px"
  sm: "8px"
  field-gap: "14px"
  md: "16px"
  lg: "28px"
  xl: "32px"
components:
  sticker-card:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sticker-white}"
    rounded: "{rounded.card}"
    padding: "32px 28px"
    width: "min(440px, 100%)"
  sticker-title:
    textColor: "{colors.brand}"
    typography: "{typography.display}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-contrast}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "16px"
    width: "100%"
  button-ghost:
    backgroundColor: "{colors.sticker-white}"
    textColor: "{colors.navy}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "16px"
    width: "100%"
  input:
    backgroundColor: "{colors.sticker-white}"
    textColor: "{colors.navy}"
    typography: "{typography.input}"
    rounded: "{rounded.input}"
    padding: "11px"
  field-label:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
  error-tag:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.sticker-white}"
    rounded: "{rounded.tag}"
    padding: "8px 14px"
  mascot-tile:
    backgroundColor: "{colors.sticker-white}"
    rounded: "{rounded.tile}"
---

# Design System: Quiz New Holland

## Overview

**Creative North Star: "Calcomanía troquelada"**

El quiz es una planilla de calcomanías de New Holland. Un campo azul saturado ocupa toda la pantalla, y todo lo que importa está pegado encima como sticker de vinilo: la tarjeta, los botones, las mascotas, hasta el error. Cada sticker tiene un borde blanco grueso de troquel, esquinas bien redondeadas, un giro leve y un canto sólido debajo, como si fuera un vinilo grueso a punto de despegarse. El usuario eligió este look a partir de una vista previa en HTML y pidió que se reprodujera tal cual.

Es un mundo alegre, con volumen y fácil de tocar, no un panel corporativo. Las mascotas (máquinas New Holland ilustradas con cara, cada una sobre su propio fondo de color plano) dan el humor. El amarillo New Holland se guarda para el título y la acción. Todo texto secundario se tiñe de azul. El rechazo que se confirmó al elegir el mundo es el login genérico: una tarjeta gris centrada sobre fondo oscuro.

Las pantallas vienen de a pocas piezas grandes. La del login tiene una tarjeta, un título, dos campos y un botón. La vida la ponen el movimiento al cargar (los stickers se pegan en secuencia) y la respuesta física al apretar (el botón se hunde sobre su canto).

**Key Characteristics:**
- Campo azul a pantalla completa con dos resplandores radiales suaves; nunca un fondo plano oscuro.
- Cada elemento importante es un sticker: borde blanco, radio amplio, giro leve, canto sólido.
- Amarillo New Holland solo en el título y la acción principal.
- Sin grises: los secundarios son azul pálido (ink-soft) o navy.
- Display gruesa y redonda (Bowlby One) para títulos; Rubik para toda la interfaz.
- Movimiento de "pegado": cae agrandado, aprieta, se asienta.

## Colors

Un azul New Holland saturado de fondo, navy para las superficies con texto, amarillo NH para lo que importa y blanco para el troquel.

### Primary
- **Amarillo New Holland** (brand): el color de la marca. Va en el título display y en el relleno de la acción principal, con texto negro (brand-contrast). También es el color del anillo de foco. En ningún otro lado.

### Secondary
- **Campo azul NH** (field): el fondo de pantalla completa. En `.field` lleva dos resplandores radiales, uno más claro (#2d6cf0) arriba a la izquierda y otro más hondo (#0d3fa8) abajo a la derecha, que le dan una luz de papel satinado sin llegar a ser un degradé de adorno.
- **Navy de tarjeta** (navy): el relleno de la tarjeta-sticker y el color del texto sobre stickers blancos (inputs, botón fantasma).

### Tertiary
- **Rojo etiqueta** (alert): solo para la etiqueta de error, con texto blanco (unos 6.7:1).
- **Colores de opción** (opt-0 rojo, opt-1 azul, opt-2 ámbar, opt-3 verde): las cuatro opciones de respuesta del juego. Es un compromiso de producto: el texto blanco encima cumple AA. Se mantienen en este mundo tal cual.

### Neutral
- **Blanco troquel** (sticker-white): el borde de todos los stickers, el relleno de los inputs, el botón fantasma y el fondo de las mascotas.
- **Azul tinta suave** (ink-soft): bajadas, etiquetas de campo y texto secundario sobre navy. Es el "gris" de este mundo, teñido de azul.
- **Negro** (brand-contrast): solo el texto sobre amarillo.

### Named Rules
**The No-Gray Rule.** El texto secundario sobre azul o navy es ink-soft, nunca gris. Hasta el canto del botón blanco está teñido de azul (#8fa6d8).

**The Earned Yellow Rule.** El amarillo NH aparece en el título, en la acción principal y en el foco. Si hay dos cosas amarillas compitiendo en una pantalla, una sobra.

## Typography

**Display Font:** Bowlby One (con Rubik, system-ui)
**Body Font:** Rubik (con system-ui, -apple-system, Segoe UI, Roboto)

**Character:** Una display gruesa, redonda y un poco bruta, que se lee como letra de calcomanía, junto a una sans amable y geométrica que se banca todos los pesos, del 400 al 900.

### Hierarchy
- **Display** (Bowlby One 400, clamp(44px, 6vw, 64px), line-height 0.95, text-wrap balance): el título de la tarjeta, en amarillo NH. Uno por pantalla.
- **Status** (Bowlby One 400, 36px): estados de espera a pantalla completa ("Cargando…"), en amarillo sobre el campo.
- **Lead** (Rubik 700, 16px): la bajada debajo del título, en ink-soft.
- **Body** (Rubik 400, 16px): texto explicativo dentro de la tarjeta, en ink-soft. Los datos puntuales (un email) van en blanco y con peso.
- **Button** (Rubik 900, 22px): la etiqueta de los botones-sticker.
- **Input** (Rubik 500, 17px): el texto que se escribe en los campos, en navy.
- **Label** (Rubik 700, 13px, tracking 0.1em, mayúsculas): etiquetas de formulario arriba de cada input, en ink-soft. Solo para campos, nunca como antetítulo de una sección.

### Named Rules
**The One Loud Voice Rule.** Bowlby One se usa para el título y los estados de pantalla completa. Botones, campos y texto van en Rubik; lo que les da fuerza es el peso (900 en botones), no la display.

## Layout

La pantalla es un escenario (`.field`, min-height 100dvh, overflow hidden) con la pieza principal centrada en una grilla (place-items center). La tarjeta mide min(440px, 100%) y lleva un padding de 32px 28px. Adentro, los campos se apilan con 14px de separación y las etiquetas quedan a 6px de su input.

Las mascotas son stickers en posición absoluta, pegados en las esquinas del campo (300/260/250/280px de ancho en desktop). Son decorativas (aria-hidden) y nunca tapan la tarjeta, que tiene z-index 2. En mobile (debajo de md) quedan solo las dos de arriba, de 150px, asomando por los bordes (-4%). La tarjeta baja a pt-32 y ocupa el ancho con 16px de margen lateral. El padding superior respeta safe-area-inset-top. Abajo quedan 56px de aire para que la etiqueta de error tenga lugar para colgar.

## Elevation & Depth

La profundidad es física, no ambiental. Cada sticker descansa sobre un **canto**, una sombra sólida desplazada hacia abajo y sin desenfoque, que se lee como el espesor del vinilo. El usuario eligió explícitamente estos cantos duros: son el material del mundo, no un recurso neobrutalista importado. Solo las mascotas y la etiqueta de error suman una sombra suave, que las despega del campo.

### Shadow Vocabulary
- **Canto de tarjeta** (`box-shadow: 0 14px 0 rgb(0 20 60 / 0.45)`): debajo de la tarjeta-sticker.
- **Canto de mascota** (`box-shadow: 0 10px 0 rgb(0 20 60 / 0.35), 0 18px 30px rgb(0 0 0 / 0.25)`): canto más sombra suave de despegue, en los stickers de mascota.
- **Canto de botón amarillo** (`box-shadow: 0 7px 0 #b3830a`; apretado `0 2px 0 #b3830a` + `translate: 0 5px`).
- **Canto de botón blanco** (`box-shadow: 0 7px 0 #8fa6d8`; apretado `0 2px 0 #8fa6d8` + `translate: 0 5px`).
- **Despegue de etiqueta** (`box-shadow: 0 8px 14px -4px rgb(0 10 40 / 0.5)`): solo sombra suave, porque la etiqueta es un sticker fino.
- **Halo de foco en input** (`box-shadow: 0 0 0 4px rgb(241 181 20 / 0.4)` con borde amarillo de 3px).

### Named Rules
**The Canto Rule.** El canto es sólido y va siempre hacia abajo. Sobre el campo se tiñe de navy y, en los botones, es un tono más oscuro del mismo relleno. Un botón apretado baja 5px y su canto se achica a 2px: el sticker se hunde, no cambia de color.

## Shapes

Cada sticker es un troquel: borde blanco sólido que escala con el tamaño (etiqueta 3px, mascota 8px, tarjeta 10px) y radio amplio que también escala (etiqueta 14px, input 16px, botón 18px, mascota 28px, tarjeta 36px). Los stickers van girados apenas: tarjeta -1°, etiqueta de error 1.5°, mascotas entre ±5° y ±8° (variable `--tilt`). Las mascotas recortan su ilustración (overflow hidden) dentro del troquel blanco.

### Named Rules
**The Die-Cut Rule.** Si algo importa, tiene borde blanco. Una superficie sin troquel es campo, no sticker.

**The Gentle Tilt Rule.** Los stickers con texto no pasan de ±1.5°. Los giros más marcados (hasta ±8°) son para las mascotas.

## Components

### Buttons
Gruesos, del ancho completo y con canto: se hunden al apretarlos como un sticker grueso.
- **Shape:** esquinas bien redondeadas (18px), ancho completo, padding de 16px.
- **Primary:** relleno amarillo NH, texto negro en Rubik 900 a 22px, canto #b3830a. Uno por pantalla.
- **Ghost (secundario):** relleno blanco troquel, texto navy, canto azul pálido #8fa6d8. Para acciones alternativas ("Entrar con otra cuenta").
- **Press:** `translate 0 5px` y el canto baja de 7px a 2px, con una transición de 0.08s. Foco: el contorno global de 3px amarillo con 2px de separación. Deshabilitado: opacidad 50% y cursor not-allowed. La etiqueta cambia a gerundio mientras trabaja ("Entrando…").

### Cards / Containers
- **Corner Style:** 36px.
- **Background:** navy, con texto blanco centrado.
- **Border:** troquel blanco de 10px.
- **Shadow Strategy:** canto de tarjeta (ver Elevation & Depth); giro de -1°.
- **Internal Padding:** 32px 28px; ancho min(440px, 100%).
- Arriba lleva el logo New Holland (38px de alto) y, 14px más abajo, el título display.

### Inputs / Fields
- **Style:** relleno blanco, texto navy en Rubik 500 a 17px, radio de 16px, borde transparente de 3px, padding de 11px, caret azul campo.
- **Label:** etiqueta en mayúsculas en ink-soft, arriba del input y alineada a la izquierda aunque la tarjeta esté centrada.
- **Focus:** el borde pasa a amarillo NH, con un halo amarillo de 4px al 40%. No hay outline.

### Error Tag (signature)
Un sticker rojo que queda colgando del borde inferior de la tarjeta (top 100%, centrado, traslado de -4px, giro de 1.5°). Tiene un troquel blanco de 3px, radio de 14px, texto blanco en 600 y padding de 8px 14px. Entra con "slap", 0.45s: llega agrandado y girado, aprieta y se asienta. Como cuelga por fuera, el formulario nunca salta cuando aparece. Va dentro de un contenedor `role="alert"`.

### Mascot Tile (signature)
Una de las cuatro ilustraciones del cliente (tractor, cosechadora, pulverizadora, TT4) en `public/mascotas/*.webp`, cada una sobre su fondo plano (celeste, amarillo, verde, verde azulado). Van con troquel blanco de 8px, radio de 28px, canto de mascota y giro propio. En dispositivos con hover se levantan 8px y giran 3° más, con 0.35s de ease-out-expo. Son decorativas: aria-hidden, alt vacío y no se pueden arrastrar.

### Stick-in Motion (signature)
Los stickers entran en secuencia con "stick": 0.7s en cubic-bezier(0.16, 1, 0.3, 1), cayendo desde -28px a escala 1.14, apretando a 0.97 y asentándose. El escalonado se maneja con `--delay` (100/220/340/460ms en las mascotas). Con prefers-reduced-motion se apagan todas las animaciones y transiciones de sticker.

### Legacy primitives (a migrar)
`/play` todavía usa las primitivas del mundo anterior: `.page`, `.card` (surface #00205b, 14px), `.btn`, `.btn-outline`, `.btn-secondary`, `.input`, `.badge` y `.timer`, sobre el navy plano #00153f, con muted gris-azulado (#b7c2dc), line (#6b7ba3) y good/bad (#34d399 / #ff6b6b). Son legado, no sistema. Cuando se rediseñe cada pantalla hay que pasarla a este mundo y no copiarlas en superficies nuevas.

## Do's and Don'ts

### Do:
- **Do** apoyar cada pantalla nueva sobre el campo azul (field con sus dos resplandores radiales), a pantalla completa.
- **Do** darle a toda pieza importante su troquel blanco, su radio amplio, un giro leve y un canto sólido hacia abajo.
- **Do** reservar el amarillo NH para el título y la acción principal (texto negro encima).
- **Do** usar ink-soft (#c9d8ff) para todo texto secundario sobre azul o navy.
- **Do** colgar los errores como etiqueta roja por fuera de la tarjeta, sin que el formulario se mueva.
- **Do** mantener los cuatro colores de opción (opt-0..3) con texto blanco AA para las respuestas del juego.
- **Do** escribir la interfaz en español rioplatense con voseo ("Entrá", "Pedile", "Revisá").
- **Do** respetar prefers-reduced-motion: sin "stick", sin "slap", sin transiciones de sticker.

### Don't:
- **Don't** armar el login genérico: una tarjeta gris centrada sobre fondo oscuro.
- **Don't** usar grises para texto secundario ni para cantos; todo se tiñe de azul.
- **Don't** usar el navy plano #00153f del mundo anterior como fondo de pantallas nuevas.
- **Don't** girar más de ±1.5° un sticker que lleva texto.
- **Don't** dibujar ni generar mascotas nuevas; las únicas son las cuatro ilustraciones del cliente en public/mascotas.
