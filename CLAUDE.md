# CLAUDE.md

Contexto para cualquier sesión que trabaje en este repo. Antes de tocar código, leer `docs/` — este archivo es un resumen, no reemplaza la especificación.

## El producto

Una app de comunidad de cine, **sin puntajes ni estrellas**. Elegir qué ver no se resuelve con un promedio de desconocidos (IMDb/Rotten Tomatoes) ni con un registro retrospectivo individual (Letterboxd) ni con conversación sin estructura (Reddit).

**Tesis:** la app no dice cuánto vale una película. Dice qué se está diciendo de ella en los lugares donde el usuario ya eligió estar.

El watchlist es el producto real. El recorrido no es "entro a debatir", es "tengo dos horas y quiero elegir bien": abrís tu lista, elegís una película, leés qué se dijo en los foros que seguís (el foro como proxy de afinidad, reemplazando el rating), y decidís. Sobre eso se monta la feature distintiva: la **nota pareada** (antes/después de ver la película, la de "antes" se congela para siempre al marcarla como vista). Los foros siempre están anclados a una película o a un tema de oficio, nunca sueltos, para que la moderación sea sostenible con una sola persona operando.

Ver `docs/decisiones-de-producto.html` para la tesis completa, qué se descartó y por qué.

## Las tres reglas que no se pueden romper

Viven en `docs/schema.sql` como constraints/triggers de base, no solo como validación de UI — si solo estuvieran en la interfaz, cualquier bug las rompe:

1. **Un hilo no puede existir sin ancla.** Todo `thread` tiene `movie_id` o `topic`, nunca ninguno ni ambos.
2. **Un post no puede existir sin declarar si revela algo.** `has_spoiler` es obligatorio y sin default: no se puede publicar sin responder la pregunta del composer.
3. **La nota previa se congela al marcar la película como vista.** Una vez que `status = 'watched'`, `note_before` y su fecha quedan inmutables para siempre — es lo que hace que el par antes/después sea verificable.

Cualquier implementación (frontend o backend) tiene que respetar estas tres reglas a nivel de datos, no solo de interfaz.

## Stack

- **Vite + React + Tailwind.** Web app responsive, mobile-first. **No es una app nativa** (a pesar de que las pantallas en `docs/` estén maquetadas dentro de un frame de teléfono — eso es el formato de presentación, no una restricción técnica).
- **Supabase** (Postgres) como backend, usando el schema de `docs/schema.sql` tal cual, con RLS.
- **TMDB** como fuente de datos de películas (se cachea localmente: `poster_path` y `backdrop_path`, no solo uno).

## Sistema de diseño

Dark-first (no es un modo opcional). Fuente completa de tokens en `docs/ui-kit.html`.

### Color

```
bg/base       #08090B   fondo de app
surface/low   #101214   cards, mensajes colapsados
surface/med   #17191D   inputs, sheets, botones circulares
surface/high  #1E2126   avatares vacíos, estados apagados

border/subtle #191C20
border/default #24272C
border/strong #33373D

text/primary   #EDEFF2  (no blanco puro)
text/secondary #8E959D
text/tertiary  #5C636B
text/disabled  #3C424A

accent/base    #0088FF  rellenos (botón primario, íconos activos)
accent/pressed #0070D6
accent/text    #4DA9FF  texto sobre fondo oscuro (el base no llega a AA)
accent/bg      rgba(0,136,255,.13)
accent/bd      rgba(0,136,255,.32)

warning  #E0A83C  (retenido en revisión — nunca en errores)
danger   #E5484D  (errores de formulario y destructivos)
```

### Tipografía

- **General Sans** (`display/*`): solo títulos y nombres de película.
- **Geist** (`body/*`, `label`, `caption`, `section`): todo lo que se lee de corrido (~70% de la app).
- Regla de mezcla: nunca General Sans en un párrafo, nunca Geist en el nombre de una película. El corte es semántico, no de tamaño.

```
display/xl   32/38   600  -3%
display/lg   26/31   600  -3%
display/md   20/26   600  -2.5%
display/sm   16/21   600  -1.8%
display/xs   15.5/19 600  -1.5%

body/lg   15/24   400
body/md   14/22.6 400   (el más usado)
body/sm   13/20   400
label     12.5/17 500
caption   11.5/16 400
section   12.5/17 600
```

### Grilla y espaciado

- Base de diseño: **375 × 812**, 4 columnas.
- Margen lateral: **16**. Gutter: **16**. Ancho útil: 343.
- Base vertical: **8**. Todo espaciado es múltiplo de 4; lo que separa bloques, múltiplo de 8.
- Escala de espaciado: 4, 8, 12, 16, 24, 32, 40, 56.
- Alto de fila de lista: 98. Nav bar: 76. Target táctil mínimo: 44×44.

### Radios

```
radius/xs   3    posters y miniaturas (casi recto: el poster es dato, no imagen)
radius/sm   8    botones chicos, tags
radius/md   10   inputs y botones grandes
radius/lg   12   cards de hilo, banners
radius/xl   22   sheets desde abajo
radius/full 100  chips, avatares, FAB
```

## Reglas de uso (no negociables)

- **El acento nunca decora.** Si algo es azul, es porque se toca, está activo o es nuevo. En una lista, el punto de novedad es lo único con color.
- **Nada en mayúsculas sostenidas.** En español se lee peor y borra las tildes — y con ellas el registro de voseo de la app.
- **El poster nunca es protagonista.** 46×66, radio 3, casi recto. Es un dato, no una imagen — es lo que separa esto de una app de streaming.
- **La elevación no usa sombras.** En oscuro no se leen. La jerarquía se construye subiendo la luminancia de la superficie (`bg` → `surface/low` → `surface/med` → `surface/high`).

## Los HTML de docs/ son la especificación visual

`docs/tanda-01-v2.html` a `docs/tanda-04-busqueda-perfil.html` maquetan las 30 pantallas en alta fidelidad, con medidas exactas (px, colores, tipografía). Hay que respetarlas al pixel al implementar — no son referencia aproximada.

**Excepción:** `docs/foros-final.html` reemplaza por completo la pantalla 01 de `docs/tanda-02-v2.html` ("Foros — los que seguís"), que quedó obsoleta. Usar siempre la versión de `foros-final.html`.
