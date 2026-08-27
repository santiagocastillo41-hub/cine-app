# cine-app

Una app de comunidad de cine, sin puntajes ni estrellas.

IMDb y Rotten Tomatoes promedian a millones de desconocidos. Letterboxd es un registro retrospectivo e individual. Reddit tiene la conversación, pero sin estructura: una película ahí es texto plano, imposible de encontrar después. Esta app vive en el hueco entre las tres.

> La app no dice cuánto vale una película. Dice qué se está diciendo de ella en los lugares donde el usuario ya eligió estar.

Esa frase es la tesis, y funcionó como criterio de corte durante todo el proyecto: cada feature que no la sostenía, quedó afuera. El documento completo de decisiones de producto —qué se descartó y por qué— está en [`docs/decisiones-de-producto.html`](docs/decisiones-de-producto.html).

## El recorrido real

No es «entro a debatir». Es **«tengo dos horas y quiero elegir bien»**: abrís tu watchlist, elegís una película, leés qué se dijo en los foros que seguís —el foro como proxy de afinidad, reemplazando el rating— y decidís. Los foros no son el destino, son la materia prima de esa decisión. Y eso resuelve el arranque en frío: el watchlist con anotaciones tiene valor estando solo, sin que haya nadie más en la app.

Sobre esa base se monta la feature distintiva: la **nota pareada**. Al guardar una película podés escribir por qué te interesa. Al marcarla como vista, escribís otra nota. Las dos juntas forman un par antes/después — y la mitad de "antes" se congela para siempre en el momento en que la marcás como vista. No es una regla de interfaz: vive como trigger en la base de datos, así que ningún bug de frontend puede romperla. Es lo que hace que el par sea verificablemente anterior, no una reseña reescrita por la memoria.

## Cómo se resolvieron los spoilers

Leer una conversación *para decidir si ver la película* y leerla *después de verla* son dos modos incompatibles en la misma pantalla. La solución tiene tres capas:

1. **Declaración obligatoria.** El campo `has_spoiler` de un post no tiene default: no se puede publicar sin responder la pregunta del composer.
2. **Colapso real, no blur.** Un mensaje colapsado no manda su texto al cliente — el `select` que arma la pantalla de hilo directamente omite el cuerpo y las menciones mientras el post sigue tapado. El blur se descartó a propósito: el texto borroso sigue siendo texto, el cerebro completa, y visualmente *invita* a tocarlo.
3. **Salida para quien no le importa.** "No pienso verla" (`spoilers_off` en `user_movie`) destapa todo para esa película puntual, de forma reversible.

## Las tres reglas que no se pueden romper

Viven como constraints y triggers en [`docs/schema.sql`](docs/schema.sql), no sólo como validación de interfaz:

1. Un hilo no puede existir sin ancla — `movie_id` o `topic`, nunca ninguno ni ambos.
2. Un post no puede existir sin declarar si revela algo — `has_spoiler` es obligatorio, sin default.
3. La nota previa se congela al marcar la película como vista — inmutable para siempre, vía trigger.

## Qué funciona hoy

Construido como caso de estudio, no como producto en producción — es honesto decir hasta dónde llegó:

| Pantalla | Estado |
|---|---|
| Mi lista (watchlist) | Completa — tabs, señal de conversación nueva, notas, tags |
| Ficha de película | Completa — estado en la lista, nota previa, hilos filtrados por foros seguidos |
| Hilo | Completo — sistema de spoilers de tres capas, menciones como chips, toggle de "no pienso verla" |
| Login | Andamiaje sin diseñar, a propósito — auth funcional, pantallas de docs/ todavía no implementadas |
| Foros, Buscar, Perfil | Placeholder — el modelo de datos y las políticas de RLS ya las soportan, falta la interfaz |

Las 30 pantallas de alta fidelidad están maqueteadas al pixel en `docs/tanda-*.html` y `docs/foros-final.html`; son la especificación visual contra la que se construyó cada pantalla terminada.

## Stack

- **Vite + React + Tailwind.** Web app responsive, mobile-first — no una app nativa, aunque las pantallas de `docs/` estén maquetadas dentro de un frame de teléfono (es el formato de presentación, no una restricción técnica).
- **Supabase** (Postgres) como backend, con Row Level Security: cada política está en `docs/schema.sql`.
- **TMDB** como fuente de datos de películas. Se cachean localmente `poster_path` y `backdrop_path` — no todas las películas tienen backdrop, así que el fallback es el poster ampliado y desenfocado.
- **react-router-dom** para el ruteo.

Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.

## Correrlo local

Necesitás Node 22+, un proyecto de Supabase (con `docs/schema.sql` aplicado) y una API key de lectura de TMDB.

```bash
npm install
cp .env.example .env
```

Completá `.env`:

```bash
# Cliente — se exponen al navegador, por eso el prefijo VITE_
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Sólo para los scripts de scripts/ — nunca llegan al cliente
SUPABASE_SECRET_KEY=
TMDB_READ_TOKEN=
```

```bash
npm run dev
```

### Datos de prueba

```bash
node scripts/check.js               # confirma que las 9 tablas existen y que TMDB responde
node scripts/seed.js                # carga 12 películas, 4 foros, usuarios y contenido de muestra — idempotente
node scripts/create-test-account.js # crea una cuenta de prueba con watchlist poblado y devuelve las credenciales
```

## Deploy

Pensado para Vercel: `vercel.json` incluye la reescritura necesaria para que las rutas del lado del cliente (`/pelicula/:id`, `/hilo/:id`) no den 404 al refrescar o compartir un link directo.

Sólo hacen falta las dos variables `VITE_` en las env vars del proyecto de Vercel — `SUPABASE_SECRET_KEY` y `TMDB_READ_TOKEN` son exclusivamente para los scripts locales de `scripts/` y nunca deberían cargarse en un entorno de deploy.

## Estructura

```
docs/           especificación de producto y diseño (HTML de alta fidelidad, schema.sql)
scripts/        scripts de Node para verificación y carga de datos
src/lib/        cliente de Supabase, contexto de sesión, helpers de TMDB/formato
src/pages/      una pantalla por archivo
src/components/ layout compartido (nav bar, contenedor de app)
```
