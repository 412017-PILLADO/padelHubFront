# Plantilla B · Nocturna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la plantilla B de "vidrio sobre papel claro" a **la única plantilla oscura del producto** — el club de noche bajo reflectores — con su par tipográfico propio, su tinta clara y su firma: el horario elegido prende como luz de cancha.

**Architecture:** B es la primera cáscara del Plan 2 y la que **valida toda la capa dark** que el Plan 1 dejó construida pero sin usar. Tres cosas que hoy están puestas y apagadas se encienden acá: `PLANTILLAS.B.inkHex` vuelve a la tinta clara (hay un test que lo exige en cuanto la hoja declare `--ink`), `cargarFuentes()` se enchufa por primera vez, y el contrato `--flow-*` se extiende con los tokens que necesita la firma. El trabajo se ordena de adentro hacia afuera: primero la capa de tokens (que es lo que hace legible todo lo demás), después las reglas de B que viven fuera de su cáscara, después el decorado, y al final la firma.

**Tech Stack:** Angular 21 standalone + signals + SSR · PrimeNG 21 · SCSS · Vitest (`@angular/build:unit-test`) · Playwright 1.61.

## Global Constraints

- Repo `padelFront`, rama **`feat/plantilla-b-nocturna`** desde `feat/plantillas-visuales` (o desde `main` si el Plan 1 ya se mergeó — verificar antes de empezar).
- **Spec de referencia obligatoria:** `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md`. Las decisiones de §2 están cerradas por el owner: no re-decidir.
- **Sin dependencias nuevas.** Comentarios, nombres y mensajes de commit **en español**.
- Todo componente nuevo: `standalone: true` + `ChangeDetectionStrategy.OnPush`.
- **SSR:** la landing se renderiza en server (`RenderMode.Server`). Nada de `window`/`localStorage`/`document` global sin guardar con `isPlatformBrowser`; el `DOCUMENT` va **inyectado**, nunca el global.
- **A esta altura sí cambian pixels, y sólo los de B.** La regla que reemplaza al "0 px" del Plan 1: **las plantillas A y C no se mueven ni un pixel**. Cualquier diferencia en A o C es una regresión. B cambia por completo y se juzga a ojo contra la spec.
- **Prohibido tocar los specs e2e existentes** salvo donde este plan lo indique explícitamente (Task 9). Si un spec falla, se arregla el código.
- **Las tres capas de tokens no se pisan** (spec §5.1): la capa 3 (tenant, inline en `<html>`) nunca declara superficie ni tinta; la capa 2 (la cáscara) nunca declara `--court`. Si te encontrás queriendo escribir `--court` en `b-nocturna/`, pará: estás rompiendo el invariante.
- **Ningún shell pone texto de párrafo sobre `--court` crudo** (spec §10). Sobre el acento van sólo textos grandes o bold, que se rigen por el umbral 3:1. Para bloques con texto corrido, `--court-deep` o una superficie propia.
- **Responsive obligatorio: 360 · 390 · 768 · 1280.** Mobile primero.
- **Los nombres de token de la spec §4 son ilustrativos; mandan los del código.** La spec escribe el contrato como `--font-display / --font-body / --font-mono`, pero `styles.scss` los declara `--display / --body / --mono` desde antes y los consumen las clases globales `.display`, `.mono` y `.eyebrow`. Este plan usa **los del código**: renombrarlos sería un refactor de plataforma que toca panel y marketing, y no es de esta fase. Misma situación con `--flow-gap`, que la spec lista y el Plan 1 descartó con razón (`.step` es un bloque sin `gap`).
- Verificación de cada task: `npm run build` verde **y** `npx playwright test e2e` verde (suite completa; hoy 20 tests).
- **Playwright se corre SIEMPRE con el path `e2e`** (`npx playwright test e2e`). Sin el path, el runner escanea `src/`, `.claude/` y el proyecto hermano `BarberApp`, carga dos `@playwright/test` y se corrompe.
- Pre-requisitos: MySQL arriba (`docker compose up -d` en `padelBack`, puerto 3308) y backend en **:8095** con `SPRING_PROFILES_ACTIVE=local`. El front lo levanta Playwright en :4400 — **no** dejar un `ng serve` propio ocupando ese puerto.
- Unit tests: `npm test`.

### Herramienta de verificación visual (leer antes del primer task que capture)

`.superpowers/sdd/capturar-offline-pie.mjs` captura las tres plantillas con un fixture fijo y sin backend (stubea `/public/config`, borra el `<script id="ng-state">` del SSR para que el stub aplique). `diff-capturas.mjs` da el diff de píxeles.

**El harness tiene ruido propio.** Dos capturas del *mismo* commit pueden diferir: A-desktop 13 px, C-mobile 84.691 px con maxDelta 137, A-mobile 0 px con 1,5 s de settle y 121.900 px con 6 s. Es rasterización bistable en las capturas `fullPage` de mobile.

**Regla:** antes de creerle a un diff no-cero en A o C, capturá **el mismo árbol dos veces** y diffeá eso. Si el control reproduce la firma, es ruido. Un 0 sigue siendo evidencia válida.

**No uses `capturar-plantillas.mjs` para diffs**: pega contra el backend real y la suite e2e crea reservas, así que la disponibilidad deriva entre corridas.

---

### Task 1: La capa oscura de B — tokens de superficie y tinta

La pieza que hace legible todo lo demás. Hoy `b-nocturna/shell.scss` no declara ningún token de superficie: hereda los de `styles.scss` (papel `#f4f6fb`, tinta `#11162b`). Este task le da su propia capa 2.

Hay un test que ya está esperando este momento: `plantillas.spec.ts:145` lee la hoja de cada cáscara y exige que `PLANTILLAS[codigo].inkHex` sea la tinta que esa hoja **realmente pinta**. En cuanto declares `--ink` en B, ese test falla — y ese fallo es tu RED.

**Files:**
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss`
- Modify: `src/app/core/landing/plantillas.ts:44`

**Interfaces:**
- Produces: la cáscara de B declara, en `:host`, la capa 2 completa de superficie/tinta/línea. Los consumidores son el propio shell, `booking-flow.scss` (vía los tokens `--flow-*` del Task 6), `club-info.scss` y `landing-footer.scss`.

- [ ] **Step 1: Correr el test que va a fallar y ver que HOY pasa**

```bash
npm test -- -t "el inkHex de la plantilla"
```

Esperado: PASS en las tres (A, B, C). Es la línea de base: el registry y las hojas están de acuerdo hoy porque B todavía hereda la tinta oscura global.

- [ ] **Step 2: Declarar la capa oscura en la cáscara**

En `src/app/features/landing/shells/b-nocturna/shell.scss`, reemplazar el bloque `:host { … }` de las líneas 16-28 por:

```scss
/* Capa 2 · la única plantilla oscura del producto (spec §6). El fondo NO es negro neutro: es el
   color del club oscurecido, así un club rojo se siente cálido y uno teal, frío — el white-label se
   lee incluso en dark. La capa 2 nunca declara --court (spec §5.1): sólo lo consume. */
:host {
  --paper: #{color-mix(in srgb, var(--court) 13%, #07090f)};
  --surface: #{color-mix(in srgb, var(--court) 10%, #121826)};
  --ink: #eef2f8;
  --ink-dim: #b7c0d4;
  --ink-faint: #8b95ab;
  --line: #{color-mix(in srgb, #fff 14%, transparent)};
  --line-strong: #{color-mix(in srgb, #fff 24%, transparent)};

  color-scheme: dark;

  min-height: 100svh; display: flex; flex-direction: column;
  color: var(--ink);
  background: var(--paper);
}
```

> **Ojo con `color-mix` dentro de `#{}`:** en SCSS, `color-mix(...)` con `var()` adentro no se puede evaluar en tiempo de compilación, así que va interpolado tal cual para que llegue al CSS. Si el compilador se queja, escribí el `color-mix` sin `#{}` — el resultado es el mismo mientras la función llegue literal al navegador. Verificá en el bundle que la declaración salió completa.

`color-scheme: dark` le dice al navegador que pinte scrollbars y controles nativos en oscuro. Sin eso, el datepicker de PrimeNG y las barras de scroll quedan claras sobre el fondo negro.

- [ ] **Step 3: Correr el test y verificar que AHORA falla**

```bash
npm test -- -t "el inkHex de la plantilla"
```

Esperado: FAIL en B con algo como `expected '#11162b' to be '#eef2f8'`. A y C siguen verdes. Ese es el recordatorio que el Plan 1 dejó armado: la hoja ya pinta claro, el registry todavía dice oscuro.

- [ ] **Step 4: Devolver el `inkHex` de B a la tinta clara**

En `src/app/core/landing/plantillas.ts`, línea 44 y el comentario de 36-43. Borrar el bloque de comentario que explica por qué B estaba forzada a `INK_OSCURA` (ya no aplica) y dejar:

```ts
  B: { codigo: 'B', nombre: 'Nocturna', descripcion: 'Oscura, luz de cancha',     esquema: 'dark',  inkHex: INK_CLARA,  fuentes: ['Anton', 'Inter Tight', 'JetBrains Mono'],   claseShell: 'tpl-b' },
```

`INK_CLARA` ya existe en el archivo (línea 32) con su docblock; sacarle la nota de "hoy no se usa" si la tiene.

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
npm test
```

Esperado: PASS, toda la suite. El test de inkHex vuelve a verde porque ahora la hoja y el registry dicen lo mismo.

- [ ] **Step 6: Verificar el contraste real sobre colores de club extremos**

Este es el motivo por el que el test existe. Con B en tinta clara, `decidirTinta()` cambia de resultado para clubes con primario claro. Verificalo a mano:

```bash
npx playwright test e2e/preview.spec.ts
```

Y a ojo, con el front levantado, abrí estas cuatro y mirá los chips de duración seleccionados y el slot elegido:

```
http://demo.localhost:4400/?plantilla=B&color=%23FFD400   (amarillo)
http://demo.localhost:4400/?plantilla=B&color=%23FF2D95   (fucsia)
http://demo.localhost:4400/?plantilla=B&color=%23111111   (negro)
http://demo.localhost:4400/?plantilla=B&color=%230a8a99   (teal, el default)
```

En las cuatro, el texto sobre el chip seleccionado tiene que ser legible. Si alguna no lo es, **no toques `decidirTinta()`** — es la regla de diseño de la spec §10 la que se está violando: ese texto no debería ir sobre `--court` crudo.

- [ ] **Step 7: Verificar que A y C no se movieron**

```bash
npm run build
npx playwright test e2e
```

Esperado: build verde, **20 passed**.

Y la comparación de píxeles, que en este task es sobre A y C únicamente:

```bash
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b1-after
git stash push -- src/app/features/landing src/app/core/landing
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b1-before
git stash pop
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b1-before .superpowers/sdd/b1-after
```

Esperado: **A-mobile, A-desktop, C-mobile y C-desktop en 0 px** (o con la firma de ruido conocida, verificada con un control del mismo árbol). B va a dar un número enorme: es el punto del task.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/landing/shells/b-nocturna/shell.scss src/app/core/landing/plantillas.ts
git commit -m "feat(plantilla-b): la capa oscura y la tinta clara del registry"
```

---

### Task 2: El color del club en una cáscara oscura

> **Este task se agregó después del Task 1**, con lo que su review encontró. No estaba en el plan
> original y su motivo está documentado en `.superpowers/sdd/progress-b.md`.

El Task 1 destapó que la capa oscura rompe tres supuestos del sistema de color, y los tres son la
misma raíz: **la capa 3 (el color del tenant) deriva sus variantes contra blanco y negro fijos, sin
saber sobre qué superficie va a caer.** Mientras las tres plantillas eran claras eso funcionaba.

Va antes del decorado y de la firma a propósito: esos dos se juzgan **a ojo**, y revisarlos sobre una
pantalla con manchones blancos y un bloque de seña ilegible desperdicia justamente las revisiones que
los validan.

**Files:**
- Modify: `src/app/core/branding/tenant-colors.ts`
- Modify: `src/app/core/branding/tenant-colors.spec.ts`
- Modify: `src/app/features/landing/shells/b-nocturna/_tokens.scss`
- Modify: `src/app/features/landing/booking/booking-flow.scss`

**Interfaces:**
- Produces: dos tokens nuevos del contrato `--flow-*`, que **toda cáscara futura debe declarar**:
  ```scss
  --flow-soft-surface   // superficie de los bloques suaves (seña, precio, íconos): `--court-soft` en
                        // las claras, una superficie propia en las oscuras
  --flow-soft-ink       // tinta sobre esos bloques
  ```

- [ ] **Step 1: Escribir el test que falla — la tinta sobre el acento no depende de la cáscara**

El hallazgo de fondo: `inkOnAccent()` elige entre blanco y **la tinta de la cáscara**. En B las dos
son claras (`#fff` L=1.0 contra `#eef2f8` L≈0.87), así que **gana blanco para cualquier color de
club** y toda la maquinaria de contraste queda desactivada. Con `#FFD400` eso da 1.36:1.

El fondo sobre el que cae ese texto es **el acento**, no la superficie de la cáscara. Así que el par
de candidatos tiene que ser siempre {blanco, tinta oscura}, sin importar si el shell es claro u
oscuro.

En `src/app/core/branding/tenant-colors.spec.ts`, agregar:

```ts
  /**
   * El texto sobre el color del club cae sobre EL ACENTO, no sobre la superficie de la cáscara. Así
   * que los dos candidatos tienen que ser siempre blanco y una tinta oscura, aunque la cáscara sea
   * oscura: en una cáscara oscura, `--ink` es claro y ofrecerlo como candidato deja a un club de
   * primario claro sin ninguna opción legible (con #FFD400 daba 1.36:1).
   */
  it('sobre un acento claro elige tinta oscura aunque la cáscara sea oscura', () => {
    const enCascaraOscura = decidirTinta('#FFD400', INK_CLARA);
    expect(enCascaraOscura.usaBlanco).toBe(false);
    expect(enCascaraOscura.ratio).toBeGreaterThanOrEqual(4.5);
  });
```

`INK_CLARA` ya está declarada arriba en ese spec como `'#eef2f8'`.

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm test -- --filter tenant-colors
```

> **El flag es `--filter`, no `-t`.** El builder es `@angular/build:unit-test`, que no acepta `-t`.

Esperado: FAIL — `expected true to be false`, porque hoy con `INK_CLARA` gana blanco.

- [ ] **Step 3: Hacer que el segundo candidato sea siempre oscuro**

En `tenant-colors.ts`, `decidirTinta()` recibe `inkHex` y lo usa como segundo candidato. El cambio es
que **el candidato oscuro no sale de la cáscara**: sale de la constante que ya existe.

Reemplazar el cuerpo de `decidirTinta` para que compare blanco contra `DARK_INK_HEX` siempre, y
dejar `inkHex` únicamente como el valor que se devuelve cuando gana el candidato oscuro **y** ese
valor es efectivamente oscuro. Concretamente:

```ts
/**
 * Elige la tinta legible sobre un fondo del color del club, evaluando el PEOR de los dos extremos
 * del gradiente (el color base y `--court-deep`, 18% más oscuro).
 *
 * Los dos candidatos son SIEMPRE blanco y la tinta oscura del sistema, sin importar el esquema de la
 * cáscara: el texto cae sobre el acento, no sobre la superficie. En una cáscara oscura ofrecer su
 * `--ink` (claro) como candidato dejaba a un club de primario claro sin ninguna opción legible.
 */
export function decidirTinta(fondoHex: string, _inkHex: string = DARK_INK_HEX): DecisionTinta {
  const rgb = hexToRgb(fondoHex);
  const ink = hexToRgb(DARK_INK_HEX);
  if (!rgb || !ink) return { usaBlanco: true, ratio: 0 };
  const deep: [number, number, number] = [rgb[0] * 0.82, rgb[1] * 0.82, rgb[2] * 0.82];
  const luminancias = [relativeLuminance(rgb), relativeLuminance(deep)];
  const peorContraste = (lTinta: number) =>
    Math.min(...luminancias.map((lFondo) => contrastRatio(lFondo, lTinta)));
  const conBlanco = peorContraste(1);
  const conInk = peorContraste(relativeLuminance(ink));
  return conBlanco >= conInk
    ? { usaBlanco: true, ratio: conBlanco }
    : { usaBlanco: false, ratio: conInk };
}
```

**Y el CSS que devuelve `inkOnAccent` deja de ser `var(--ink)`**, que en B es claro. Pasa a ser el
hex oscuro literal:

```ts
/** Texto legible sobre el color del club, listo para CSS. `#fff` si el color no es parseable. */
export function inkOnAccent(hex: string | null | undefined, inkHex: string = DARK_INK_HEX): string {
  if (!hex || !hexToRgb(hex)) return '#fff';
  return decidirTinta(hex, inkHex).usaBlanco ? '#fff' : DARK_INK_HEX;
}
```

> **Ojo con el parámetro que queda sin usar.** Si `_inkHex` deja de tener sentido, **sacalo de las dos
> firmas y de sus llamadores** en vez de dejarlo como decoración: `applyTenantColors` lo recibe y lo
> pasa, y `club.store.ts` lo calcula desde el registry. Si lo sacás, sacá también el campo `inkHex`
> del registry **sólo si no queda ningún otro consumidor** — hay un test que lo pinea contra la hoja
> de cada cáscara (`plantillas.spec.ts`), así que fijate si sigue teniendo sentido antes de borrarlo.
> **Decidilo vos y explicá la decisión en el reporte.** Las dos salidas son defendibles; lo que no es
> defendible es dejar un parámetro que finge influir y no influye.

- [ ] **Step 4: Correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS. **Ojo:** si sacaste `inkHex` del registry, el test de `plantillas.spec.ts` que lo
pinea contra la hoja de cada cáscara desaparece con él — eso está bien si el campo se fue, pero
**no** borres el test dejando el campo.

- [ ] **Step 5: Sacar los bloques casi-blancos del panel oscuro**

`--court-soft` la calcula la capa 3 como `color-mix(in srgb, c 12%, #fff)` — **casi blanco para
cualquier color de club**. Dentro del panel oscuro de B eso son manchones. Hay cuatro:

- `booking-flow.scss:381` `.sena-box` — y encima `.sena-text` (`:391`) pinta con `--ink-dim`, que
  ahora es `#b7c0d4`: **≈1.7:1, para todos los clubes**, no sólo los de primario claro.
- `booking-flow.scss:101` `.step-price`
- `booking-flow.scss:285` `.any-ic`
- `booking-flow.scss:346` `.check-ring`

Tokenizarlos con el valor de hoy como fallback, igual que los nueve del contrato:

```scss
.sena-box { background: var(--flow-soft-surface, var(--court-soft)); }
.sena-text { color: var(--flow-soft-ink, var(--ink-dim)); }
.step-price { background: var(--flow-soft-surface, var(--court-soft)); }
.any-ic { background: var(--flow-soft-surface, var(--court-soft)); }
.check-ring { background: var(--flow-soft-surface, var(--court-soft)); }
```

> Los selectores y las propiedades exactas salen de leer esas cuatro reglas: puede que alguna use
> `--court-soft` en `border` o en `box-shadow` en vez de `background`. **Tokenizá lo que realmente
> haya**, no lo que dice este snippet. Y documentá los dos tokens nuevos en el header del contrato,
> junto a los nueve que ya están.

- [ ] **Step 6: Declarar los dos tokens en las tres cáscaras**

En `a-afiche/_tokens.scss` y `c-tarjeta/_tokens.scss` (que son claras, así que conservan el valor de
hoy):

```scss
  /* Bloques suaves (seña, precio, íconos): el lavado del color del club sobre papel claro. */
  --flow-soft-surface: var(--court-soft);
  --flow-soft-ink: var(--ink-dim);
```

En `b-nocturna/_tokens.scss`, una superficie propia en vez del lavado casi-blanco:

```scss
  /* `--court-soft` es `color-mix(c 12%, #fff)`: casi blanco para cualquier club, y dentro del panel
     oscuro queda un manchón con texto ilegible (≈1.7:1). En la nocturna los bloques suaves son una
     veladura del color sobre la propia superficie oscura. */
  --flow-soft-surface: color-mix(in srgb, var(--court) 18%, var(--surface));
  --flow-soft-ink: var(--ink-dim);
```

- [ ] **Step 7: Sacar `--court-deep` de los textos sobre superficie oscura**

`--court-deep` es el color del club **oscurecido**: sobre la superficie oscura de B desaparece. Dos
lugares, los dos fuera de la cáscara:

- `club-info.scss:20` — `.ic-link` (los links de WhatsApp e Instagram), ≈2.4:1 con el teal default.
- `landing-footer.scss:36,38,40` — es el color de **hover**, así que los links del pie se vuelven
  *menos* legibles al pasar el mouse.

El pie ya se separa en el Task 4, que le da a B su propio bloque; **si estás haciendo este task antes
que el 4, arreglá acá sólo `club-info.scss`** y dejá el pie para allá, para no tocar dos veces el
mismo archivo. Para `.ic-link`, sobre fondo oscuro:

```scss
:host-context(.tpl-b) .ic-link { color: color-mix(in srgb, var(--court) 55%, var(--ink)); }
:host-context(.tpl-b) .ic-link:hover { color: var(--ink); }
```

Y arreglá el comentario obsoleto de `landing-footer.scss:34`, que dice
`"── PLANTILLAS B y C · sobre fondo claro (héroe / rail) ──"`: B ya no está sobre fondo claro, y ése
es justo el comentario que va a leer quien toque el hover.

- [ ] **Step 8: Verificar el contraste sobre los cuatro colores extremos**

Con la config stubeada en `plantilla: 'B'` — **no** con `?plantilla=B`, que se aplica después de
`applyBranding` y termina midiendo la tinta de la A (lo descubrió el Task 1).

Medí, para `#FFD400`, `#FF2D95`, `#111111` y `#0a8a99`: el chip de duración seleccionado, el horario
seleccionado, el bloque de seña y el texto adentro.

Esperado: **los cuatro ≥4.5:1 en el chip y el slot** (con la tinta oscura ganando en amarillo), y el
bloque de seña legible en los cuatro. Si el amarillo sigue por debajo, el Step 3 no aplicó.

- [ ] **Step 9: Verificar que A y C no se movieron**

Este task toca `tenant-colors.ts`, que usan **las tres** plantillas. Es el de mayor riesgo de
regresión del plan.

```bash
npm run build
npx playwright test e2e
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b2-after
git stash push -- src/app
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b2-before
git stash pop
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b2-before .superpowers/sdd/b2-after
```

Esperado: **20 passed**, y **A y C en 0 px**. `preview.spec.ts:35` ("el color de preview deriva la
tinta legible del afiche") es el que valida que A no cambió de tinta: si falla, cambiaste el
comportamiento de las claras y no sólo el de la oscura.

> El fixture del harness usa un color oscuro, así que en A y C `decidirTinta` ya elegía blanco antes
> y después. Si A o C se mueven, es por los tokens del Step 6, no por el Step 3.

- [ ] **Step 10: Commit**

```bash
git add src/app/core/branding/ src/app/features/landing/
git commit -m "fix(branding): la tinta sobre el acento no depende del esquema de la cascara"
```

---

### Task 3: El par tipográfico de B — la primera vez que `cargarFuentes()` se enchufa

El Plan 1 dejó `fuentes.ts` escrito, testeado y **deliberadamente sin llamar**, porque ninguna hoja referenciaba las familias del registry. B es la primera cáscara que sí las va a usar, así que acá se enciende.

**Files:**
- Modify: `src/app/features/landing/shells/b-nocturna/shell.ts`
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss`
- Modify: `src/app/core/landing/fuentes.ts` (sólo el docblock, que dice "hoy no la llama nadie")
- Test: `src/app/features/landing/shells/b-nocturna/shell.spec.ts` (crear)

**Interfaces:**
- Consumes: `cargarFuentes(doc: Document, url: string): void` y `urlFuentes(fuentes: readonly string[]): string` de `src/app/core/landing/fuentes.ts` y `plantillas.ts`; `PLANTILLAS.B.fuentes` = `['Anton', 'Inter Tight', 'JetBrains Mono']`.
- Produces: la cáscara de B declara `--display`, `--body` y `--mono` en `:host`, y pide su hoja de Google Fonts desde el constructor (también en SSR).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/features/landing/shells/b-nocturna/shell.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BookingService } from '../../../../core/api/booking.service';
import { ClubStore } from '../../club.store';
import { BookingStore } from '../../booking.store';
import { PLANTILLAS, urlFuentes } from '../../../../core/landing/plantillas';
import { ShellBComponent } from './shell';

/** Doble del servicio: la cáscara no debe pegarle a la red para montarse. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
};

describe('ShellB · tipografía por plantilla', () => {
  it('pide la hoja de Anton/Inter Tight/JetBrains Mono al montarse', () => {
    TestBed.configureTestingModule({
      imports: [ShellBComponent],
      providers: [
        provideRouter([]),
        MessageService,
        ClubStore,
        BookingStore,
        { provide: BookingService, useValue: bookingFalso },
      ],
    });
    TestBed.createComponent(ShellBComponent);

    const doc = TestBed.inject(DOCUMENT);
    const esperada = urlFuentes(PLANTILLAS.B.fuentes);
    expect(doc.head.querySelector(`link[href="${esperada}"]`)).not.toBeNull();
  });
});
```

> **Antes de correrlo:** abrí `shells/b-nocturna/shell.ts` y copiá el nombre real de la clase y sus `providers`. Si la cáscara no provee `ClubStore`/`BookingStore` (los toma del injector de `Landing`), tenés que proveerlos vos en el `TestBed`, que es lo que hace el snippet. Ajustá los paths relativos según dónde termine el archivo.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- -t "tipografía por plantilla"
```

Esperado: FAIL — `expected null not to be null`. La cáscara todavía no pide ninguna hoja.

- [ ] **Step 3: Enchufar `cargarFuentes` en la cáscara**

En `src/app/features/landing/shells/b-nocturna/shell.ts`, agregar al `import` y a la clase:

```ts
import { DOCUMENT } from '@angular/common';
import { cargarFuentes } from '../../../../core/landing/fuentes';
import { PLANTILLAS, urlFuentes } from '../../../../core/landing/plantillas';

// … dentro de la clase:
  private readonly doc = inject(DOCUMENT);

  constructor() {
    // Primera cáscara con par tipográfico propio (spec §6.2). Corre también en SSR, así que el HTML
    // que sale del server ya pide Anton/Inter Tight/JetBrains Mono y la plantilla no parpadea con la
    // fuente de plataforma hasta que hidrata.
    cargarFuentes(this.doc, urlFuentes(PLANTILLAS.B.fuentes));
  }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npm test -- -t "tipografía por plantilla"
```

Esperado: PASS.

- [ ] **Step 5: Declarar los tokens de fuente en la hoja**

En `b-nocturna/shell.scss`, dentro del `:host` que armaste en el Task 1, agregar:

```scss
  /* Par tipográfico propio (spec §6): Anton para display, Inter Tight para texto, JetBrains Mono
     para datos. El <link> lo pide el constructor de shell.ts. */
  --display: 'Anton', system-ui, sans-serif;
  --body: 'Inter Tight', system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
```

- [ ] **Step 6: Neutralizar el `font-stretch` de plataforma**

Esto es una trampa real, no un detalle. `styles.scss:69-76` define la clase global `.display` con `font-stretch: 125%`, que es el eje de ancho variable de **Archivo**. Anton no tiene eje de ancho: pedirle 125% hace que el navegador **sintetice** el estirado, y el resultado se ve deformado.

En `b-nocturna/shell.scss`, agregar:

```scss
/* `.display` de plataforma pide `font-stretch: 125%` — el eje de ancho de Archivo. Anton no tiene
   ese eje, así que el navegador lo sintetiza y la deforma. Acá se anula. */
:host ::ng-deep .display {
  font-stretch: normal;
  letter-spacing: 0.01em;   /* Anton es muy condensada de fábrica: un pelo de aire la hace legible */
}
```

> **Por qué `::ng-deep` y no un token:** `.display` la emiten `club-info`, `landing-footer`, `booking-flow` y la propia cáscara — cuatro componentes distintos. Un token pediría tocar las cuatro hojas para consumirlo. `:host ::ng-deep` acotado al subárbol de B es la excepción del mismo tipo que la spec ya acepta para `.politica-link` (ver el header de `booking-flow.scss`). **Anotalo en el reporte** para que la review lo juzgue.

- [ ] **Step 7: Verificar que las fuentes llegan y que el SSR las pide**

```bash
npm run build
```

Y con el front levantado:

```bash
curl -s http://costapadel.localhost:4400/ | grep -o 'fonts.googleapis.com[^"]*'
```

Esperado: **dos** URLs — la de plataforma que sigue en `index.html` (Archivo/Hanken/Space Mono, que usan el panel y el marketing) y la de B. Que aparezcan en el HTML del **server** es el punto: si sólo aparecen en el inspector, la inyección se está haciendo en cliente.

> **Sobre la segunda URL:** la spec §10 pide verificar "que la landing de un tenant trae un solo shell y un solo par tipográfico". Hoy no se cumple porque `styles.scss` declara el trío de plataforma globalmente y el panel lo necesita. Cerrar eso es un task del final del Plan 2, cuando **las cinco** cáscaras declaren sus fuentes. **No lo intentes acá** — el Plan 1 ya descartó esa vía una vez, con medición: `.superpowers/sdd/progress.md`, sección "Decisión del owner · Task 6".

- [ ] **Step 8: Verificar y commitear**

```bash
npm test
npx playwright test e2e
```

Esperado: **20 passed**.

```bash
git add src/app/features/landing/shells/b-nocturna/ src/app/core/landing/fuentes.ts
git commit -m "feat(plantilla-b): par tipografico propio inyectado por SSR"
```

---

### Task 4: Las reglas de B que viven fuera de su cáscara

Tres archivos estilan a B desde afuera, y los tres asumen fondo claro. Este task los pasa a oscuro. **Es el que más riesgo tiene de romper C**, porque el footer comparte reglas entre las dos.

**Files:**
- Modify: `src/app/features/landing/club/club-info.scss:40-48`
- Modify: `src/app/features/landing/club/landing-footer.scss:35-40`
- Modify: `src/app/features/landing/club/brand-mark.ts`

**Interfaces:**
- Consumes: los tokens de superficie/tinta que declaró el Task 1.
- Produces: nada nuevo. Es adaptación de reglas existentes.

- [ ] **Step 1: Separar las reglas del footer de B de las de C**

`landing-footer.scss:35-40` tiene hoy seis reglas que agrupan `:host(.b-foot)` con `:host(.c-foot)`:

```scss
:host(.b-foot) a, :host(.c-foot) a { color: var(--ink-dim); text-decoration: none; }
:host(.b-foot) a:hover, :host(.c-foot) a:hover { color: var(--court-deep); }
:host(.b-foot) .arrep-link, :host(.c-foot) .arrep-link { color: var(--ink-dim); font-family: inherit; }
:host(.b-foot) .arrep-link:hover, :host(.c-foot) .arrep-link:hover { color: var(--court-deep); }
:host(.b-foot) .politica-link, :host(.c-foot) .politica-link { color: var(--ink-dim); font-family: inherit; }
:host(.b-foot) .politica-link:hover, :host(.c-foot) .politica-link:hover { color: var(--court-deep); }
```

**El problema:** los tres `:hover` usan `var(--court-deep)`, que es el color del club **oscurecido**. Sobre el papel claro de C funciona; sobre el fondo nocturno de B es casi invisible.

Dejar las de C tal cual y darle a B las suyas:

```scss
/* C conserva el hover sobre el color oscurecido: funciona sobre su papel claro. */
:host(.c-foot) a { color: var(--ink-dim); text-decoration: none; }
:host(.c-foot) a:hover { color: var(--court-deep); }
:host(.c-foot) .arrep-link { color: var(--ink-dim); font-family: inherit; }
:host(.c-foot) .arrep-link:hover { color: var(--court-deep); }
:host(.c-foot) .politica-link { color: var(--ink-dim); font-family: inherit; }
:host(.c-foot) .politica-link:hover { color: var(--court-deep); }

/* B es oscura: `--court-deep` (el color del club oscurecido) desaparece contra el fondo nocturno.
   El hover sube a la tinta plena, que es lo que hace de "encendido" en esta plantilla. */
:host(.b-foot) a { color: var(--ink-dim); text-decoration: none; }
:host(.b-foot) a:hover { color: var(--ink); }
:host(.b-foot) .arrep-link { color: var(--ink-dim); font-family: inherit; }
:host(.b-foot) .arrep-link:hover { color: var(--ink); }
:host(.b-foot) .politica-link { color: var(--ink-dim); font-family: inherit; }
:host(.b-foot) .politica-link:hover { color: var(--ink); }
```

- [ ] **Step 2: Pasar el vidrio de las tarjetas de info a oscuro**

`club-info.scss:40-48`. La receta actual es vidrio claro: `color-mix(in srgb, var(--surface) 58%, transparent)` con borde `#fff 60%` y brillo especular blanco. Sobre fondo oscuro, `--surface` ya es oscuro (Task 1), así que el fondo se resuelve solo — pero el borde y el brillo blancos siguen siendo de la versión clara y quedan demasiado fuertes.

```scss
:host-context(.tpl-b) .ic-card {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.4); backdrop-filter: blur(22px) saturate(1.4);
  border: 1px solid color-mix(in srgb, #fff 12%, transparent);
  border-radius: 20px;
  box-shadow: 0 20px 50px -28px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
}
:host-context(.tpl-b) .ic-ic { background: color-mix(in srgb, var(--court) 26%, transparent); }
```

Y actualizar el comentario de sincronía de las líneas 32-38: apunta a `shells/b-nocturna/_tokens.scss`, y las dos copias ahora son **oscuras**. Si el Task 7 unifica la receta en un mixin, este comentario se borra — anotalo.

- [ ] **Step 3: Revisar `brand-mark` sobre fondo oscuro**

Abrí `src/app/features/landing/club/brand-mark.ts` y mirá las reglas `:host-context(.b-brandline)`. El fallback sin logo es el logo de Padel Hub, que es una imagen con tinta oscura: sobre el fondo nocturno puede desaparecer.

Si el logo del club es una imagen subida por el club, **no la toques** — es su marca y el club eligió el fondo oscuro al elegir la plantilla. Pero el **fallback** de Padel Hub sí es tuyo:

```scss
/* El logo de Padel Hub es tinta oscura: sobre el fondo nocturno de B necesita invertirse. El logo
   subido por el club NO se toca — es su marca. */
:host-context(.b-brandline) .tpl-logo img[src*='logo'] { filter: invert(1) brightness(1.6); }
```

> **Verificá primero cómo se distingue el fallback del logo del club** en ese componente: si el template usa un `@if` con dos `<img>` distintos, poné la regla sobre el del fallback y borrá el selector de atributo, que es frágil. Mirá el markup antes de copiar esta regla.

- [ ] **Step 4: Verificar que C no se movió**

Este es el chequeo que justifica el task. C comparte esas reglas de footer:

```bash
npm run build
npx playwright test e2e
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b3-after
git stash push -- src/app/features/landing
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b3-before
git stash pop
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b3-before .superpowers/sdd/b3-after
```

Esperado: **20 passed**, y **C-mobile y C-desktop en 0 px** (con control de ruido si dan distinto de cero). A también en 0. Si C se movió, separaste mal las reglas del Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/club/
git commit -m "feat(plantilla-b): la info, el pie y la marca en version oscura"
```

---

### Task 5: El decorado nocturno — reflectores sobre el club

Acá B deja de ser "la clara con gradientes" y pasa a ser la de noche. El fondo plano del Task 1 se convierte en el telón con luz.

**Files:**
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss`

**Interfaces:**
- Consumes: `--paper`, `--surface`, `--ink*` del Task 1; `--court` y `--court-2` de la capa 3 (tenant).
- Produces: nada nuevo.

- [ ] **Step 1: Reemplazar el fondo por el telón nocturno**

El `background: var(--paper)` que dejó el Task 1 pasa a ser un telón con dos reflectores. Rol del color según la spec §6: **primario masa teñida + luz, secundario luz (halo)**.

En `b-nocturna/shell.scss`, dentro del `:host`:

```scss
  /* El club de noche bajo reflectores (spec §6). Dos focos arriba —el primario a la izquierda, el
     secundario a la derecha (cae al primario si el club no eligió uno)— y un resplandor bajo que
     levanta el pie del fondo. `--paper` (el color del club oscurecido) es la masa teñida; los
     radiales son la luz. `fixed` hace que la luz no scrollee con el contenido: el telón se queda
     quieto y el contenido pasa por delante. */
  background:
    radial-gradient(70% 55% at 12% -10%, color-mix(in srgb, var(--court) 55%, transparent), transparent 68%),
    radial-gradient(60% 48% at 90% -4%, color-mix(in srgb, var(--court-2, var(--court)) 42%, transparent), transparent 70%),
    radial-gradient(90% 60% at 50% 112%, color-mix(in srgb, var(--court-2, var(--court)) 22%, transparent), transparent 72%),
    var(--paper);
  background-attachment: fixed;
```

- [ ] **Step 2: Bajar el vidrio de la nav a la noche**

La nav (`.b-nav`, líneas 34-41) sigue con el vidrio claro: `--surface 60%` y borde `#fff 45%`. Con `--surface` ya oscuro el fondo se arregla solo, pero el borde queda demasiado brillante:

```scss
.b-nav {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 16px;
  padding: 13px clamp(16px, 5vw, 40px);
  background: color-mix(in srgb, var(--paper) 72%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  border-bottom: 1px solid color-mix(in srgb, #fff 10%, transparent);
}
```

Y el borde del pie (línea 67), por el mismo motivo:

```scss
.b-foot { margin-top: auto; padding: 20px clamp(16px, 5vw, 40px);
  border-top: 1px solid color-mix(in srgb, #fff 10%, transparent);
  color: var(--ink-faint); }
```

- [ ] **Step 3: Revisar el `.eyebrow` global**

`styles.scss:86-92` define `.eyebrow` con `color: var(--court-deep)`. Igual que el hover del footer: el color del club oscurecido desaparece sobre fondo nocturno.

Buscá si B emite esa clase:

```bash
grep -rn "eyebrow" src/app/features/landing/
```

Si aparece en el subárbol de B, agregá en `b-nocturna/shell.scss`:

```scss
/* `.eyebrow` de plataforma va en `--court-deep`, que sobre el fondo nocturno se apaga. Acá sube al
   color pleno del club, que es lo que hace de acento en esta plantilla. */
:host ::ng-deep .eyebrow { color: color-mix(in srgb, var(--court) 70%, var(--ink)); }
```

Si **no** aparece, no agregues la regla — sería CSS muerto. Decilo en el reporte.

- [ ] **Step 4: Revisión visual en los cuatro anchos**

La spec §10 exige 360 · 390 · 768 · 1280. Levantá el front y mirá B en los cuatro:

```
http://costapadel.localhost:4400/
```

Buscá específicamente: que el héroe no compita con la card de reserva en desktop, que en <900px el héroe siga oculto (regla existente), que los reflectores no dejen el texto del pie sobre una zona demasiado clara, y que el `backdrop-filter` de la nav tenga algo que difuminar cuando la página está scrolleada arriba de todo.

- [ ] **Step 5: Verificar que A y C siguen quietas**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. Este task sólo toca `b-nocturna/shell.scss`, así que A y C no pueden haberse movido — pero la suite valida que el flujo de reserva sigue funcionando sobre el fondo nuevo.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/shells/b-nocturna/shell.scss
git commit -m "feat(plantilla-b): el telon nocturno con los dos reflectores del club"
```

---

### Task 6: La firma — el horario elegido prende como luz de cancha

La firma de B según la spec §6. Tiene una dificultad de arquitectura que hay que resolver bien: **el efecto vive dentro del flujo de reserva, que no tiene identidad visual propia**. La solución no es que B alcance al flujo con un selector — eso es exactamente lo que el Plan 1 desarmó. Es **extender el contrato `--flow-*`** con los tokens que el estado seleccionado necesita.

**Files:**
- Modify: `src/app/features/landing/booking/booking-flow.scss`
- Modify: `src/app/features/landing/shells/b-nocturna/_tokens.scss`
- Modify: `src/app/features/landing/shells/a-afiche/_tokens.scss`
- Modify: `src/app/features/landing/shells/c-tarjeta/_tokens.scss`

**Interfaces:**
- Produces: dos tokens nuevos en el contrato, que **toda cáscara futura debe declarar**:
  ```scss
  --flow-slot-sel-shadow   // sombra/halo del horario seleccionado
  --flow-chip-sel-shadow   // sombra/halo del chip seleccionado (duración y día)
  ```
  Con el valor de A como fallback, igual que los nueve que ya existen.

- [ ] **Step 1: Tokenizar el estado seleccionado, con el valor de hoy como fallback**

Hoy `booking-flow.scss:176` es:

```scss
.slot[aria-pressed='true'] { background: var(--court); border-color: var(--court); color: var(--ink-on-accent, #fff); }
```

y `:124` hace lo equivalente para `.chip`. Ninguno tiene sombra. Agregarles el token con `none` de fallback deja A y C **exactamente** como están:

```scss
.slot[aria-pressed='true'] {
  background: var(--court); border-color: var(--court); color: var(--ink-on-accent, #fff);
  box-shadow: var(--flow-slot-sel-shadow, none);
}
```

Y en `.chip[aria-pressed='true']` (línea 124), agregar al final del bloque:

```scss
  box-shadow: var(--flow-chip-sel-shadow, none);
```

Documentar los dos en el header del contrato (líneas 7-21 de esa hoja), junto a los otros nueve:

```
     --flow-slot-sel-shadow  sombra del horario seleccionado. `none` en las plantillas claras; en la
                             nocturna es el halo que hace que el horario "prenda" como luz de cancha.
     --flow-chip-sel-shadow  ídem para los chips de duración y día.
```

- [ ] **Step 2: Declarar `none` explícito en A y C**

El contrato dice que toda cáscara declara todos los tokens, aunque coincidan con el fallback — así se lee qué eligió cada una en vez de deducirlo.

En `a-afiche/_tokens.scss` y en `c-tarjeta/_tokens.scss`, agregar:

```scss
  /* El estado seleccionado se marca sólo con el color del club: sin halo. El halo es la firma de la
     nocturna y sobre papel claro se vería sucio. */
  --flow-slot-sel-shadow: none;
  --flow-chip-sel-shadow: none;
```

- [ ] **Step 3: Verificar que A y C no se movieron**

```bash
npm run build
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b5a-after
git stash push -- src/app/features/landing
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b5a-before
git stash pop
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b5a-before .superpowers/sdd/b5a-after
```

Esperado: **0 px en los cuatro pares de A y C**. Este paso es puro andamiaje: si algo se movió acá, transcribiste mal un valor y conviene saberlo antes de agregarle el halo a B.

**Ojo:** el fixture del harness clickea un horario antes de la foto, así que el estado seleccionado **sí** está en cuadro. Es justamente lo que querés verificar.

- [ ] **Step 4: Prender la luz en B**

En `b-nocturna/_tokens.scss`:

```scss
  /* LA FIRMA (spec §6): el horario elegido prende como luz de cancha. Dos capas — un halo exterior
     del color del club, que es la luz derramándose, y un anillo interior claro que hace de filamento.
     Sobre el fondo nocturno el halo tiene dónde derramarse; ésta es la razón por la que la firma es
     de esta plantilla y no de las claras. */
  --flow-slot-sel-shadow:
    0 0 0 1px color-mix(in srgb, #fff 30%, transparent) inset,
    0 0 18px -2px color-mix(in srgb, var(--court) 85%, transparent),
    0 0 42px -6px color-mix(in srgb, var(--court) 60%, transparent);

  /* Los chips prenden más suave: el protagonista es el horario, no la duración. */
  --flow-chip-sel-shadow:
    0 0 14px -4px color-mix(in srgb, var(--court) 70%, transparent);
```

- [ ] **Step 5: Verificar la firma a ojo, con cuatro colores de club**

El halo se arma con `--court`, así que su intensidad depende del color del club. Con el front levantado:

```
http://demo.localhost:4400/?plantilla=B&color=%230a8a99
http://demo.localhost:4400/?plantilla=B&color=%23FFD400
http://demo.localhost:4400/?plantilla=B&color=%23111111
http://demo.localhost:4400/?plantilla=B&color=%23FF2D95
```

Elegí un horario en cada una. Lo que buscás: que prenda de verdad en las cuatro. **El caso difícil es el negro** (`#111111`): un halo negro sobre fondo oscuro no se ve. Si queda apagado, la salida **no** es subir la opacidad — es mezclar el halo con la tinta clara para que un club oscuro también tenga luz:

```scss
  --flow-slot-sel-shadow:
    0 0 0 1px color-mix(in srgb, #fff 30%, transparent) inset,
    0 0 18px -2px color-mix(in srgb, var(--court) 70%, var(--ink)),
    0 0 42px -6px color-mix(in srgb, var(--court) 50%, transparent);
```

Probá las dos y quedate con la que funcione en los cuatro colores. **Decí en el reporte cuál elegiste y por qué**, con lo que viste en el caso negro.

- [ ] **Step 6: Verificar la suite completa**

```bash
npm test
npx playwright test e2e
```

Esperado: **20 passed**. `plantillas.spec.ts` reserva de punta a punta en B: es la prueba de que el flujo único sobrevive a la piel nueva.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/landing/booking/booking-flow.scss src/app/features/landing/shells/
git commit -m "feat(plantilla-b): el horario elegido prende como luz de cancha"
```

---

### Task 7: El vidrio de B, con una sola fuente de verdad

Deuda que el Plan 1 dejó anotada y que este plan hereda empeorada: la receta del vidrio está escrita a mano en **dos** hojas (`b-nocturna/_tokens.scss` y `club/club-info.scss`), sincronizadas sólo por comentarios, y el Task 4 acaba de tocar las dos. `@extend` no cruza de hoja, pero un `@mixin` en un partial compartido sí, y no cuesta ninguna dependencia.

**Files:**
- Create: `src/app/features/landing/shells/b-nocturna/_vidrio.scss`
- Modify: `src/app/features/landing/shells/b-nocturna/_tokens.scss`
- Modify: `src/app/features/landing/club/club-info.scss`

**Interfaces:**
- Produces: `@mixin vidrio-nocturno($radio)` en `shells/b-nocturna/_vidrio.scss`, consumido por los dos lugares que hoy copian la receta.

- [ ] **Step 1: Extraer el mixin**

Crear `src/app/features/landing/shells/b-nocturna/_vidrio.scss`:

```scss
/* ===================================================================
   La receta del vidrio nocturno, en un solo lugar.

   Dos consumidores: los tokens --flow-* con los que la cáscara viste al flujo de reserva
   (_tokens.scss) y las tarjetas de info (club/club-info.scss). Estaban copiados a mano en las dos
   hojas porque `@extend` no cruza de hoja — un `@mixin` sí.

   El radio se parametriza porque los dos consumidores difieren a propósito: 28px el panel del flujo,
   20px las tarjetas, que son más chicas.
   =================================================================== */
@mixin vidrio-nocturno($radio) {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  backdrop-filter: blur(22px) saturate(1.4);
  border: 1px solid color-mix(in srgb, #fff 12%, transparent);
  border-radius: $radio;
  box-shadow: 0 20px 50px -28px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
}
```

- [ ] **Step 2: Consumirlo desde las tarjetas de info**

En `club/club-info.scss`, reemplazar el bloque `:host-context(.tpl-b) .ic-card { … }` que dejó el Task 4 por:

```scss
@use '../shells/b-nocturna/vidrio' as vidrio;

:host-context(.tpl-b) .ic-card { @include vidrio.vidrio-nocturno(20px); }
```

Y **borrar** el comentario de sincronía de las líneas 32-38: ya no hay dos copias que sincronizar. Ése es el punto del task.

> **Ojo con el `@use`:** va al principio del archivo, antes de cualquier regla. Si `club-info.scss` ya tiene otros `@use`, ponelo con ellos. El path es relativo a la hoja, verificalo.

- [ ] **Step 3: Consumirlo desde los tokens del flujo**

`_tokens.scss` no puede usar el mixin directamente: sus valores son tokens sueltos (`--flow-surface`, `--flow-border`, …), no un bloque de declaraciones. Dejá los tokens como están y **apuntá el comentario al mixin** para que se lea de dónde salen los valores:

```scss
   /* Los valores de vidrio de acá son los del mixin `vidrio-nocturno` de `_vidrio.scss`, partidos en
      tokens sueltos porque el contrato --flow-* los pide así. Si tocás el mixin, tocá estos. */
```

**Si podés unificar de verdad** —por ejemplo declarando los tokens *dentro* del mixin con un flag— hacelo y decilo. Si no, dejarlo con el comentario apuntando a un solo origen ya es mejor que dos copias mutuamente referenciadas.

- [ ] **Step 4: Verificar que el CSS compilado no cambió**

Este task es 100% refactor: el resultado tiene que ser byte-idéntico.

```bash
npm run build
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b6-after
git stash push -- src/app/features/landing
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b6-before
git stash pop
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b6-before .superpowers/sdd/b6-after
```

Esperado: **0 px en los 6 pares**, B incluida. Cualquier diferencia es un valor mal transcripto al mixin.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/shells/b-nocturna/ src/app/features/landing/club/club-info.scss
git commit -m "refactor(plantilla-b): el vidrio nocturno en un solo lugar"
```

---

### Task 8: Contraste y accesibilidad de la plantilla oscura

B es la primera superficie oscura del producto. Este task la audita antes de que la vea un club.

> **Ampliado después del Task 1**, con dos hallazgos de su review que el Task 2 no cubre:
>
> - **El datepicker de PrimeNG no se pone oscuro.** `color-scheme: dark` gobierna los widgets del
>   navegador, nunca los tokens de un tema JS. Se llega desde el chip "Otra fecha". Si lo oscurecés,
>   **tenés que dar vuelta `--p-primary-contrast-color` (`tenant-colors.ts:93`) en el mismo cambio** o
>   el día seleccionado queda invertido. Ojo: `tenant-colors.ts:89-92` documenta que los componentes
>   de PrimeNG se pintan sobre superficies claras del sistema en las tres plantillas, con una nota de
>   "no la arregles" — o sea que esto **contradice una decisión anotada**. Si al mirarlo te parece que
>   la decisión sigue en pie para B, dejalo y explicá por qué; lo que no vale es no mirarlo.
> - **Con un club casi negro el acento desaparece contra la superficie oscura.** No es sólo el chip
>   seleccionado y los numeritos de paso: también el logo de respaldo en la nav de B
>   (`brand-mark.ts:30`, `color: var(--court)`). La raíz es que la capa 3 deriva las variantes del
>   acento contra blanco y negro fijos, sin saber sobre qué superficie caen
>   (`tenant-colors.ts:135-136`). **Auditá acento-contra-superficie, no sólo tinta-contra-acento**,
>   que es lo que arregló el Task 2.

**Files:**
- Create: `src/app/features/landing/shells/b-nocturna/contraste.spec.ts`
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss` (si el audit encuentra algo)

**Interfaces:**
- Consumes: `decidirTinta(fondoHex, inkHex)` de `src/app/core/branding/tenant-colors.ts`.

- [ ] **Step 1: Escribir el test de contraste de la capa oscura**

Los tokens de B son fijos (no dependen del club), así que su contraste se puede pinear en un unit test. Crear `src/app/features/landing/shells/b-nocturna/contraste.spec.ts`:

```ts
/**
 * B es la única plantilla oscura del producto (spec §6). Sus tokens de superficie y tinta son fijos
 * —no dependen del color del club—, así que su contraste se puede pinear acá sin browser.
 *
 * Los valores tienen que coincidir con los que declara `shell.scss`. Si alguien los cambia sin
 * mirar el contraste, este test lo frena.
 */
const INK = '#eef2f8';
const INK_DIM = '#b7c0d4';
const INK_FAINT = '#8b95ab';
/** El peor fondo posible: el más claro que puede dar `--paper` es con un club casi blanco. */
const PAPER_PEOR = '#22252c';

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('plantilla B · contraste de la capa oscura', () => {
  it('la tinta principal supera 7:1 (AAA para texto normal)', () => {
    expect(contraste(INK, PAPER_PEOR)).toBeGreaterThanOrEqual(7);
  });

  it('la tinta secundaria supera 4.5:1 (AA para texto normal)', () => {
    expect(contraste(INK_DIM, PAPER_PEOR)).toBeGreaterThanOrEqual(4.5);
  });

  it('la tinta terciaria supera 3:1 (AA para texto grande y componentes)', () => {
    // --ink-faint sólo se usa en captions y el © del pie, que son texto chico pero no crítico.
    // Si algún día lleva texto de párrafo, este umbral tiene que subir a 4.5.
    expect(contraste(INK_FAINT, PAPER_PEOR)).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Correr y ajustar los tokens si hace falta**

```bash
npm test -- -t "contraste de la capa oscura"
```

Si alguno falla, **subí el token en `shell.scss` hasta que pase** y actualizá la constante del test. No bajes el umbral. Los valores del Task 1 son un punto de partida razonable, no una verdad revelada.

- [ ] **Step 3: Auditar la tinta sobre el color del club, en la plantilla oscura**

Con B en tinta clara, `decidirTinta()` elige entre `#fff` y `#eef2f8` — dos claros. Para un club con primario claro, **ninguna** de las dos va a ser legible sobre `--court` crudo.

Eso no es un bug del cálculo: es exactamente la regla de la spec §10 ("ningún shell pone texto de párrafo sobre `--court` crudo"). Lo que este paso verifica es que **B la cumple**.

```bash
grep -n "var(--court)" src/app/features/landing/shells/b-nocturna/shell.scss
```

Por cada resultado, preguntate: ¿hay texto encima? Si lo hay y es texto corrido, cambialo a `--court-deep` o a una superficie propia. Anotá en el reporte cada uso de `--court` y por qué es seguro.

- [ ] **Step 4: Verificar los estados de foco**

Sobre fondo oscuro, el anillo de foco por defecto del navegador puede desaparecer. Con el front levantado, recorré B **sólo con el teclado** (Tab desde arriba): nav → chips de duración → días → horarios → canchas → campos → confirmar → links del pie.

Cada parada tiene que verse. Si alguna no, agregá en `b-nocturna/shell.scss`:

```scss
/* El anillo de foco por defecto se apaga sobre el fondo nocturno. */
:host ::ng-deep :focus-visible {
  outline: 2px solid color-mix(in srgb, var(--court) 60%, #fff);
  outline-offset: 2px;
}
```

Decí en el reporte qué encontraste recorriendo con teclado, aunque no hayas tenido que cambiar nada.

- [ ] **Step 5: Verificar y commitear**

```bash
npm test
npm run build
npx playwright test e2e
```

Esperado: **20 passed**.

```bash
git add src/app/features/landing/shells/b-nocturna/
git commit -m "test(plantilla-b): pinea el contraste de la capa oscura"
```

---

### Task 9: La puerta de la fase — e2e y revisión visual en los cuatro anchos

La spec §11 fija la puerta de cada cáscara: *reserva completa e2e en su tenant + revisión visual en los 4 anchos*. El e2e ya existe (`plantillas.spec.ts` reserva en `costapadel`); lo que falta es la evidencia de que B es **oscura**, que hoy ningún test afirma.

**Files:**
- Modify: `e2e/plantillas.spec.ts`
- Create: `.superpowers/sdd/capturar-b-anchos.mjs`

**Interfaces:**
- Consumes: el helper `reservar()` que ya está en ese spec.

- [ ] **Step 1: Agregar al e2e la afirmación de que B es oscura**

`plantillas.spec.ts` verifica hoy que cada tenant renderiza su cáscara y llega al éxito. No dice nada del esquema. Agregá, dentro del `test` existente y **sin tocar el helper `reservar()`**:

```ts
    // B es la única plantilla oscura (spec §6): el fondo del shell tiene que ser oscuro de verdad,
    // no el papel claro de plataforma. Se mide la luminancia del color computado en vez de comparar
    // contra un hex, porque `--paper` se tiñe con el color del club y cambia por tenant.
    if (tpl === 'B') {
      const luminancia = await page.locator(shell).evaluate((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const [r, g, b] = bg.match(/\d+/g)!.slice(0, 3).map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      });
      expect(luminancia).toBeLessThan(0.2);
    }
```

> **Este es el único cambio autorizado a un spec e2e en todo el plan.** Es agregar una aserción, no relajar ninguna. Si el spec falla por otra cosa, se arregla el código.

- [ ] **Step 2: Correr y verificar**

```bash
npx playwright test e2e/plantillas.spec.ts
```

Esperado: **3 passed**. Si B falla acá, el fondo no está quedando oscuro en el render real — que es distinto del fixture del harness offline, y es justo lo que este test agrega.

> **Si falla de forma intermitente** en el click de `.confirm` con "element was detached from the DOM": no es tuyo. Es una carrera conocida de `loadAvailability()`, documentada en `.superpowers/sdd/debug-plantillas-flake.md`. Aparece cuando la disponibilidad de los próximos días está consumida por corridas anteriores. No agregues reintentos al spec.

- [ ] **Step 3: Capturar B en los cuatro anchos que pide la spec**

El harness existente captura 390 y 1440. La spec §10 pide 360 · 390 · 768 · 1280. Crear `.superpowers/sdd/capturar-b-anchos.mjs`:

```js
/**
 * Captura la plantilla B en los cuatro anchos que exige la spec (§10): 360 · 390 · 768 · 1280.
 * Requiere el front en :4400 y el backend en :8095.
 *
 *   node .superpowers/sdd/capturar-b-anchos.mjs <carpeta-destino>
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const destino = resolve(process.argv[2] ?? '.superpowers/sdd/b-anchos');
mkdirSync(destino, { recursive: true });

const ANCHOS = [360, 390, 768, 1280];

const browser = await chromium.launch();
for (const width of ANCHOS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto('http://costapadel.localhost:4400/', { waitUntil: 'networkidle' });
  await page.locator('.dur-chips .chip').first().waitFor({ state: 'visible', timeout: 20_000 });
  // Elegir un horario para que la firma (el halo del slot) entre en la foto.
  await page.locator('.times .slot:not(:disabled)').first().click();
  await page.locator('.ccard.any').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(1200); // colchón para fuentes y el backdrop-filter
  await page.screenshot({ path: `${destino}/B-${width}.png`, fullPage: true });
  console.log(`ok B-${width}`);
  await page.close();
}
await browser.close();
```

- [ ] **Step 4: Mirar las cuatro capturas**

```bash
node .superpowers/sdd/capturar-b-anchos.mjs .superpowers/sdd/b-anchos
```

Abrí las cuatro y verificá, en cada una:

1. El fondo es oscuro y **teñido** por el color del club, no negro neutro.
2. El horario seleccionado **prende** — el halo se ve.
3. La nav de arriba tiene vidrio con algo detrás que difuminar.
4. En 360 y 390 el héroe está oculto y se arranca directo en la reserva.
5. Ningún texto queda ilegible: ni sobre el fondo, ni sobre el vidrio, ni sobre el color del club.
6. Anton no se ve deformada (si se ve estirada, el `font-stretch` del Task 3 no está aplicando).

- [ ] **Step 5: Verificar que A y C no se movieron en todo el plan**

La comparación acumulada, contra el estado anterior al Task 1. El SHA sale de la rama base: es el commit sobre el que se creó `feat/plantilla-b-nocturna`, que `git merge-base` devuelve sin que tengas que anotarlo.

```bash
BASE=$(git merge-base feat/plantillas-visuales HEAD)
echo "comparando contra $BASE"
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b-final-after
git checkout "$BASE" -- src/app/features/landing src/app/core/landing
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/b-final-before
git checkout HEAD -- src/app/features/landing src/app/core/landing
node .superpowers/sdd/diff-capturas.mjs .superpowers/sdd/b-final-before .superpowers/sdd/b-final-after
```

> Si el Plan 1 ya se mergeó y la rama salió de `main`, cambiá `feat/plantillas-visuales` por `main` en la primera línea. Verificá con `git status` que el árbol quedó limpio después del segundo `checkout`.

Esperado: **A-mobile, A-desktop, C-mobile, C-desktop en 0 px** (con control de ruido si dan distinto de cero). B enorme, como corresponde.

- [ ] **Step 6: Verificar la suite completa y commitear**

```bash
npm test
npm run build
npx playwright test e2e
```

Esperado: **20 passed**, `npm test` verde, build sin warnings ni budget.

```bash
git add e2e/plantillas.spec.ts
git commit -m "test(plantilla-b): el e2e afirma que la nocturna es oscura"
```

---

## Cierre de la fase B

Con los 8 tasks hechos: B es la plantilla oscura que la spec describe, con su par tipográfico propio inyectado por SSR, su capa de tinta auditada, y el horario que prende como luz de cancha. A y C no se movieron un pixel.

**Qué NO cambió y es correcto que no haya cambiado:** el flujo de reserva (mismos pasos, mismas validaciones, misma seña), la galería del panel sigue siendo un `<select>`, y las plantillas D y E siguen cayendo a la A. Eso es el resto del Plan 2.

**Antes de empezar la cáscara E**, verificar:
- `npx playwright test e2e` → 20 passed, con la aserción nueva de oscuridad en B.
- `npm test` verde, incluido el test de contraste de la capa oscura y el de `inkHex` (que ahora exige `INK_CLARA` para B).
- `npm run build` verde, sin warnings de budget.
- Las cuatro capturas de B en 360 · 390 · 768 · 1280, revisadas contra la lista del Task 9 Step 4.
- Comparación de A y C contra el commit previo al Task 1 → 0 px.

**Lo que B le deja resuelto a E:** E reusa el mismo par tipográfico (spec §6), así que `cargarFuentes` ya está probado y la URL de esas tres familias ya está verificada. E es clara, así que **no** hereda la capa oscura — pero sí hereda los dos tokens nuevos del contrato (`--flow-slot-sel-shadow`, `--flow-chip-sel-shadow`), que va a declarar en `none` o con su propio valor.

**Deuda que este plan deja anotada:**
- El `:host ::ng-deep .display` del Task 3 es la segunda excepción a la regla de encapsulación del contrato (la primera es `.politica-link`). Si una tercera cáscara necesita lo mismo, conviene un token `--flow-display-stretch` en vez de acumular excepciones.
- La spec §10 pide "un solo par tipográfico por landing" y hoy siguen viajando dos (el de plataforma desde `index.html` más el de B). Se cierra cuando las cinco cáscaras declaren las suyas; la medición que justifica no hacerlo antes está en `.superpowers/sdd/progress.md`.
- La carrera de `loadAvailability()` (`.superpowers/sdd/debug-plantillas-flake.md`) sigue abierta y es la causa del e2e intermitente.
