# Plantilla E · Diurna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar la quinta plantilla — **E · Diurna**, la hermana clara de B: un panel de vidrio apoyado a caballo del borde de un campo de color a plena saturación — y, antes de tocarla, saldar las tres deudas que la review de la fase B dejó explícitamente agendadas para *antes* de E.

**Architecture:** Dos mitades. **Los Tasks 1-4 son las deudas** que E vuelve caras si no se pagan primero: el contrato `--flow-*` no tiene quién lo haga cumplir y E es el cuarto autor que tiene que satisfacerlo; el color del club casi negro degenera y E lo hereda; `.display` hardcodea dos ejes de Archivo y E, que usa Anton, sería la **tercera** neutralización — el umbral que el plan de B ya fijó para convertirlas en tokens. **Los Tasks 5-9 son E**: registro, cáscara, el campo de color con el vidrio a caballo, la firma y la puerta de fase.

**Tech Stack:** Angular 21 standalone + signals + SSR · PrimeNG 21 · SCSS · Vitest (`@angular/build:unit-test`) · Playwright 1.61.

## Global Constraints

- Repo `padelFront`, rama **`feat/plantilla-e-diurna`** desde `feat/plantilla-b-nocturna`. **Es el tercer piso de una pila**: `feat/plantillas-visuales` (PR #11) → `feat/plantilla-b-nocturna` (PR #12) → ésta. Si los dos de abajo se mergean antes de terminar, rebasear sobre `main`.
- **Spec de referencia obligatoria:** `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md`. Las decisiones de §2 están cerradas por el owner: no re-decidir. §6.1 es el contrato que impide que E y C terminen siendo primas — **no es una guía, es un contrato**.
- **Sin dependencias nuevas.** Comentarios, nombres y mensajes de commit **en español**.
- Todo componente nuevo: `standalone: true` + `ChangeDetectionStrategy.OnPush`.
- **SSR:** la landing se renderiza en server. Nada de `window`/`localStorage`/`document` global sin guardar con `isPlatformBrowser`; el `DOCUMENT` va **inyectado**, nunca el global.
- **Las plantillas A, B, C y D no se mueven ni un pixel.** Es la misma promesa que sostuvo la fase B, con una plantilla más en la lista. La prueba preferida es **por construcción** (que el valor computado no pueda diferir), no por capturas — ver la nota del harness abajo.
- **Las tres capas de tokens no se pisan** (spec §5.1): la capa 3 (tenant, inline en `<html>`) nunca declara superficie ni tinta; la capa 2 (la cáscara) nunca declara `--court`. Si te encontrás escribiendo `--court:` dentro de `e-diurna/`, pará.
- **Ningún shell pone texto de párrafo sobre `--court` crudo** (spec §10). Sobre el acento van sólo textos grandes o bold, con umbral 3:1. Para texto corrido, `--court-deep` o una superficie propia.
- **Responsive obligatorio: 360 · 390 · 768 · 1280.** Mobile primero.
- **Prohibido tocar los specs e2e existentes** salvo donde este plan lo indique explícitamente (Task 9).
- Verificación de cada task: `npm run build` verde **y** `npx playwright test e2e` verde (suite completa; hoy 20 tests).
- **Playwright se corre SIEMPRE con el path `e2e`** (`npx playwright test e2e`). Sin el path escanea `src/`, `.claude/` y el proyecto hermano `BarberApp`, carga dos `@playwright/test` y se corrompe.
- Unit tests: `npm test`. **El flag de filtro es `--filter <nombre-de-suite>`**, un regex sobre **nombres de test**, no rutas: `npm test -- --filter <archivo>` corre **cero tests y sale verde**.

### Entorno y trampas confirmadas (leer antes del primer task)

- MySQL en 3308 (contenedor `padel-mysql`), backend en **:8095** con `SPRING_PROFILES_ACTIVE=local`, front en :4400 lo levanta Playwright.
- **La suite e2e envenena la base de dev**: crea reservas reales y no las limpia. Cuando la disponibilidad de los días cercanos se agota, empiezan a fallar specs que no tienen nada que ver. Si falla algo ajeno a tu cambio, **mirá la disponibilidad antes de sospechar de vos**. Cancelá los sobrantes por el endpoint de cancelación de la app; nunca borres filas.
- **`plantillas.spec.ts` y `reserva.spec.ts` fallan intermitentemente** en el click de `.confirm` con "element was detached from the DOM" — es una carrera de `loadAvailability()` ya diagnosticada (`.superpowers/sdd/debug-plantillas-flake.md`), ajena a esta rama. Re-correr una vez en el mismo commit. **Nunca agregar reintentos a un spec.**
- **Medir contraste con `?plantilla=E` engaña**: el preview se aplica *después* de `applyBranding`, así que se termina midiendo la tinta de la plantilla real del tenant. Hay que stubear la config con `plantilla: 'E'`.
- **El harness visual tiene dos modos de falla.** Ruido bistable en capturas mobile `fullPage` (dos capturas del mismo commit difieren por decenas de miles de píxeles con firma idéntica) y —peor— **puede dar un CERO FALSO**: `capturar-offline-pie.mjs` compite con el rebuild de `ng serve` después de un checkout, y si captura antes, las dos tandas salen del mismo bundle y todo lee 0 px. **Matar el server, hacer el checkout, arrancar uno nuevo, esperar a que reporte `Watching for file changes`, y recién ahí capturar — por estado.**
- **Las capturas no llegan** a la pantalla de éxito/seña (sólo `e2e/sena.spec.ts` la recorre), ni al estado scrolleado, ni al calendario abierto, ni a ningún `:hover`.

---

### Task 1: El contrato `--flow-*` deja de ser una frase y pasa a ser una puerta

Hoy `booking-flow.scss` y los tres `_tokens.scss` dicen *"Toda cáscara nueva tiene que declarar los catorce"* y **nada lo hace cumplir**. El numeral está mantenido a mano en cuatro archivos. Y los fallbacks apuntan a los valores de A, así que una cáscara que se olvide un token **se ve como la A en ese aspecto** en vez de romperse — exactamente el modo de falla que un fallback está diseñado para esconder.

E es el cuarto autor que tiene que satisfacer ese contrato, y D es el quinto. Esto va primero.

**Files:**
- Create: `src/app/features/landing/booking/contrato-flow.spec.ts`

**Interfaces:**
- Consumes: nada de código de producción — lee las hojas como texto, igual que `plantillas.spec.ts` y `contraste.spec.ts` ya hacen.
- Produces: una puerta que cualquier cáscara nueva tiene que pasar.

- [ ] **Step 1: Escribir el test que falla**

**Ojo con B antes de escribir una línea:** `b-nocturna/_tokens.scss` declara **nueve** tokens literalmente; los otros cinco los emite `@include vidrio.vidrio-nocturno-tokens(28px)`, que vive en `b-nocturna/_vidrio.scss`. Un test que sólo busque `--flow-…:` con texto plano **va a dar un falso rojo en B**. Hay que seguir el `@include`.

Crear `src/app/features/landing/booking/contrato-flow.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * El contrato `--flow-*` en prosa no lo hacía cumplir nada: `booking-flow.scss` y los `_tokens.scss`
 * decían "toda cáscara nueva tiene que declarar los catorce" y el numeral estaba mantenido a mano en
 * cuatro archivos. Peor: los fallbacks apuntan a los valores de la plantilla A, así que una cáscara
 * que se olvida un token se ve COMO LA A en ese aspecto en vez de romperse — el modo de falla que un
 * fallback está diseñado para esconder.
 *
 * Este spec convierte la frase en una puerta. Lee las hojas como texto (mismo patrón que
 * `plantillas.spec.ts` y `contraste.spec.ts`) en vez de duplicar la lista, así no puede desincronizarse.
 */
const leer = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Los tokens que el flujo consume, leídos de su propia hoja: `var(--flow-x, fallback)`. */
function tokensQueElFlujoConsume(): string[] {
  const css = sinComentarios(leer('src/app/features/landing/booking/booking-flow.scss'));
  const encontrados = new Set<string>();
  for (const m of css.matchAll(/var\(\s*(--flow-[a-z0-9-]+)/g)) encontrados.add(m[1]);
  return [...encontrados].sort();
}

/**
 * Los tokens que una cáscara declara. Sigue los `@include <ns>.<mixin>(...)` hasta el partial que los
 * define: la B emite cinco de sus catorce desde `_vidrio.scss`, así que buscar sólo texto plano acá
 * daría un falso rojo.
 */
function tokensQueDeclara(dirShell: string): string[] {
  let css = sinComentarios(leer(`${dirShell}/_tokens.scss`));
  for (const inc of css.matchAll(/@include\s+([a-z0-9_-]+)\.([a-z0-9_-]+)\s*\(/gi)) {
    const partial = sinComentarios(leer(`${dirShell}/_${inc[1]}.scss`));
    const cuerpo = partial.split(`@mixin ${inc[2]}`)[1];
    if (cuerpo === undefined) throw new Error(`No encontré el mixin ${inc[2]} en ${dirShell}/_${inc[1]}.scss`);
    css += cuerpo;
  }
  const encontrados = new Set<string>();
  for (const m of css.matchAll(/(--flow-[a-z0-9-]+)\s*:/g)) encontrados.add(m[1]);
  return [...encontrados].sort();
}

const SHELLS = ['a-afiche', 'b-nocturna', 'c-tarjeta'];

describe('contrato --flow-*', () => {
  it('el flujo consume al menos un token (si esto falla, el parser se rompió)', () => {
    expect(tokensQueElFlujoConsume().length).toBeGreaterThan(5);
  });

  it.each(SHELLS)('la cáscara %s declara TODOS los tokens que el flujo consume', (shell) => {
    const consume = tokensQueElFlujoConsume();
    const declara = tokensQueDeclara(`src/app/features/landing/shells/${shell}`);
    expect(declara).toEqual(expect.arrayContaining(consume));
  });

  it.each(SHELLS)('la cáscara %s no declara tokens que nadie consuma', (shell) => {
    const consume = tokensQueElFlujoConsume();
    const declara = tokensQueDeclara(`src/app/features/landing/shells/${shell}`);
    expect(consume).toEqual(expect.arrayContaining(declara));
  });
});
```

> El segundo `it.each` es el que evita que el contrato se convierta en un desván: un token que ninguna cáscara consume es tan malo como uno que falta.

- [ ] **Step 2: Correr y verificar que pasa con las tres cáscaras de hoy**

```bash
npm test -- --filter "contrato --flow"
```

Esperado: PASS. Si **B** da rojo, el seguimiento del `@include` no funcionó — arreglá el parser, **no** el `_tokens.scss` de B.

- [ ] **Step 3: Verificar que el test puede fallar (mutación)**

Sacá una línea de `c-tarjeta/_tokens.scss` — por ejemplo `--flow-marca-display` — y corré de nuevo:

```bash
npm test -- --filter "contrato --flow"
```

Esperado: FAIL en la cáscara `c-tarjeta`. **Revertí la línea** y confirmá que vuelve a verde. Sin esta evidencia el spec es decorativo: pegá la salida de las dos corridas en el reporte.

- [ ] **Step 4: Borrar el numeral mantenido a mano**

El número "catorce" está escrito en cuatro archivos (`booking-flow.scss` y los tres `_tokens.scss`). Ahora que hay un test, el numeral es una segunda fuente de verdad que sólo puede desincronizarse. Reemplazalo por una frase que apunte al test, del estilo *"los tokens que el flujo consume; `contrato-flow.spec.ts` verifica que esta cáscara los declare todos"*.

- [ ] **Step 5: Verificar y commitear**

```bash
npm test
npm run build
```

Esperado: verde. No hace falta e2e: es un spec nuevo más comentarios.

```bash
git add src/app/features/landing/
git commit -m "test(landing): el contrato --flow-* pasa a ser una puerta y no una frase"
```

---

### Task 2: Los dos tokens que el club casi negro necesita

La review de la fase B midió en vivo lo que le pasa a un club de marca casi negra en la plantilla oscura: el anillo del check a **1,05:1**, los numeritos de paso a **1,02**, los bordes de seña a **1,06**. Y encontró el peor, que no estaba en el inventario: `.chip:hover` y `.slot:hover` ponen `border-color: var(--court)`, así que con `#111111` el hover **borra** el único límite visible del control (3,33:1 → 1,02:1). No falla en señalar: borra.

La raíz es que la capa 3 deriva las variantes del acento contra blanco y negro fijos, **sin saber sobre qué superficie caen**. Se arregla con dos tokens del contrato, no con uno: las reglas se parten en acento-como-tinta/ícono y acento-como-línea/borde.

**Files:**
- Modify: `src/app/features/landing/booking/booking-flow.scss`
- Modify: `src/app/features/landing/shells/a-afiche/_tokens.scss`
- Modify: `src/app/features/landing/shells/b-nocturna/_tokens.scss`
- Modify: `src/app/features/landing/shells/c-tarjeta/_tokens.scss`

**Interfaces:**
- Produces: dos tokens que **toda cáscara debe declarar** (y que el Task 1 ahora hace cumplir):
  ```scss
  --flow-accent-ink    // el color del club usado como tinta o ícono
  --flow-accent-line   // el color del club usado como línea, borde o contorno
  ```

- [ ] **Step 1: Encontrar todos los usos crudos**

```bash
grep -n "var(--court)" src/app/features/landing/booking/booking-flow.scss
```

Clasificá cada resultado en **tinta/ícono** o **línea/borde**. Los que la review nombró: `.check-ring`, `.step-num`, el borde de la caja de seña, `.chip:hover` / `.slot:hover` (`border-color`), el borde de `.step.done` y el contorno de `.ccard.is-selected`. **Trabajá con lo que encuentres**, no con esta lista — puede haber más.

**No toques** los usos donde `--court` es *fondo* con `--ink-on-accent` encima: ésos ya los evalúa `decidirTinta()` y están cubiertos.

- [ ] **Step 2: Tokenizar con el valor de hoy como fallback**

Cada uso pasa a `var(--flow-accent-ink, var(--court))` o `var(--flow-accent-line, var(--court))` según su familia. Con el fallback igual al valor actual, **este paso solo no cambia nada en ninguna plantilla**.

Documentá los dos tokens en el encabezado del contrato de `booking-flow.scss`, junto a los que ya están.

- [ ] **Step 3: Declararlos en A y C con el valor de hoy**

En `a-afiche/_tokens.scss` y `c-tarjeta/_tokens.scss`:

```scss
  /* El color del club se usa crudo: sobre papel claro tiene contraste de sobra. */
  --flow-accent-ink: var(--court);
  --flow-accent-line: var(--court);
```

- [ ] **Step 4: Verificar que NADA se movió todavía**

```bash
npm run build
npm test
```

Esperado: verde, incluido el test del contrato del Task 1 (que ahora exige los dos tokens nuevos en las tres cáscaras — si B todavía no los declara, este paso te lo dice).

Y la comparación de píxeles, que en este punto tiene que dar **0 px en las cinco plantillas capturables**, B incluida, porque todavía no cambió ningún valor:

```bash
node .superpowers/sdd/capturar-offline-pie.mjs .superpowers/sdd/e2-andamio-after
```
(con el procedimiento de server fresco por estado descrito en las Global Constraints)

Este checkpoint es el que separa "transcribí bien" de "rompí algo": si acá no da 0, no sigas.

- [ ] **Step 5: Darle a B los valores que la sacan de la degeneración**

En `b-nocturna/_tokens.scss`:

```scss
  /* El color del club crudo, sobre la superficie oscura, colapsa cuando el club es casi negro: el
     anillo del check medía 1,05:1 y el hover de un chip BORRABA el único límite del control
     (3,33:1 → 1,02:1). La receta es la misma que ya usan --flow-soft-ink-accent y el halo de la
     firma: mezclar hacia la tinta, que le agrega luz al club oscuro sin lavar al brillante. */
  --flow-accent-ink: color-mix(in srgb, var(--court) 55%, var(--ink));
  --flow-accent-line: color-mix(in srgb, var(--court) 55%, var(--ink));
```

Los dos arrancan con el mismo valor **a propósito**: existen separados porque las dos familias van a divergir cuando alguna plantilla lo necesite, no porque hoy difieran. Dejalo dicho en el comentario.

- [ ] **Step 6: Medir las cinco degeneraciones con los cuatro colores**

Con la config stubeada en `plantilla: 'B'` — **no** con `?plantilla=B`. Medí, para `#111111`, `#FFD400`, `#FF2D95` y `#0a8a99`: el anillo del check, los numeritos de paso, el borde de la caja de seña, y el borde de un chip **en hover**.

Esperado: **los cuatro por encima de 3:1 con los cuatro colores**. Si el negro sigue corto, subí la proporción de tinta en la mezcla — no bajes el umbral.

- [ ] **Step 7: Verificar que A y C siguen quietas**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. Y la comparación de píxeles: **A y C en 0 px**; B cambia sólo donde el acento tocaba línea o ícono.

**Nota:** las capturas no llegan a ningún `:hover` ni a la pantalla de seña. Para A y C la prueba fuerte no es la captura sino que declaran los tokens **exactamente** como `var(--court)`, que es lo que el fallback ya resolvía — decilo así en el reporte.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/landing/
git commit -m "feat(landing): el acento del club se adapta a la superficie de la cascara"
```

---

### Task 3: `.display` deja de hardcodear los ejes de Archivo

`styles.scss` define la clase global `.display` con `font-stretch: 125%` y `font-weight: 800` — **los dos son ejes de Archivo**, la fuente de plataforma. Anton no tiene ninguno de los dos: trae un solo peso, 400. Cualquier cáscara que cambie `--display` a una familia sin esos ejes hereda estirado **y** negrita sintetizados por el navegador, que engordan trazos y cierran contrapunzones, y **escalan con el tamaño**.

B ya los neutraliza con `:host ::ng-deep .display`. **E usa Anton también, así que sería la tercera** — y C (Outfit) y D (IBM Plex Sans) vienen atrás. Es el umbral que el plan de B fijó para convertirlas en tokens en vez de acumular excepciones.

**Files:**
- Modify: `src/styles.scss`
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss`
- Test: `src/app/features/landing/shells/b-nocturna/contraste.spec.ts` *(sólo si el parser del anillo se rompe — ver Step 4)*

**Interfaces:**
- Produces: dos tokens de plataforma con el valor de Archivo por defecto:
  ```scss
  --display-stretch   // 125% (el eje de ancho de Archivo)
  --display-weight    // 800
  ```

- [ ] **Step 1: Tokenizar la clase global con el valor de hoy**

En `src/styles.scss`, en `:root`:

```scss
  /* Los dos ejes que `.display` le pide a Archivo. Una cáscara con otra familia los pisa en su
     :host en vez de neutralizar la clase con ::ng-deep: Anton no tiene ninguno de los dos y el
     navegador los SINTETIZA (engorda trazos, cierra contrapunzones) escalando con el tamaño. */
  --display-stretch: 125%;
  --display-weight: 800;
```

Y en la regla `.display`, reemplazar los dos literales por `var(--display-stretch)` y `var(--display-weight)`. **Nada más** — el valor por defecto es el de hoy, así que A, C y el panel no se mueven.

- [ ] **Step 2: Verificar que nada se movió**

```bash
npm run build
```

Y la comparación de píxeles: **las tres plantillas en 0 px**. Este paso es puro andamiaje.

- [ ] **Step 3: Cambiar la neutralización de B por los tokens**

En `b-nocturna/shell.scss`, borrar el bloque `:host ::ng-deep .display { font-stretch: normal; font-weight: 400; … }` y declarar en su `:host`, junto a `--display`/`--body`/`--mono`:

```scss
  /* Anton no tiene eje de ancho ni pesos arriba de 400: pedirlos hace que el navegador los sintetice. */
  --display-stretch: normal;
  --display-weight: 400;
```

**Conservá el `letter-spacing`** si el bloque lo tenía — ése no es un eje sintetizado, es una decisión tipográfica, y va donde estaba.

Esto **elimina la segunda excepción de encapsulación del producto**. Decilo en el reporte: quedan dos (`.politica-link` y el anillo de foco de B), y son de clases distintas.

- [ ] **Step 4: Verificar que B no se movió**

```bash
npm test
npm run build
```

Esperado: verde. **Ojo:** `contraste.spec.ts` parsea el bloque `:focus-visible` de esa misma hoja y toma el primer match — si borrar el bloque de `.display` mueve las líneas, confirmá que sigue leyendo el bloque correcto. Si se rompe, arreglá el parser anclándolo a `:host ::ng-deep :focus-visible`.

Y la comparación: **las tres en 0 px**, B incluida. Cualquier diferencia significa que los tokens no reprodujeron lo que hacía el `::ng-deep`.

- [ ] **Step 5: Commit**

```bash
git add src/styles.scss src/app/features/landing/shells/b-nocturna/
git commit -m "refactor(tipografia): los ejes de .display salen de tokens y no de Archivo"
```

---

### Task 4: El © del pie sale de abajo de AA

A 390px el © del pie lleva `opacity: .6` por una regla mobile de `landing-footer.scss` **compartida por las tres plantillas**, lo que lo deja en **2,86-3,82:1** aun con la tinta subida. Está por debajo de AA en A, B y C.

La fase B no lo tocó porque su promesa era no mover A ni C. **Acá sí se toca**, y es la razón de que este task exista por separado: es el único de la rama que mueve pixels en A y C **a propósito**.

**Files:**
- Modify: `src/app/features/landing/club/landing-footer.scss`

- [ ] **Step 1: Medir el estado actual en las tres plantillas**

Con el front levantado, a 390px, medí el contraste computado del `.foot-copy` en `acepadel`, `costapadel` y `urbanpadel`. Anotá los tres números: son la línea de base contra la que se juzga el arreglo.

- [ ] **Step 2: Subir el contraste sin perder la jerarquía**

El `opacity: .6` existe para que el © no compita con los links. La salida es conservar esa jerarquía por **color** en vez de por opacidad, que es lo que la hunde por debajo del umbral:

```scss
/* El © es secundario, pero secundario no es ilegible: `opacity: .6` lo dejaba en 2,86-3,82:1 a 390px
   en las tres plantillas, debajo de AA. La jerarquía ahora la da el color, que se puede medir. */
.foot-copy { opacity: 1; color: var(--ink-faint); }
```

> Verificá qué selector lleva hoy el `opacity` y en qué media query — el snippet de arriba es la forma, no necesariamente el selector exacto. Y comprobá que `--ink-faint` alcanza los 4,5:1 en las **tres** plantillas; si en alguna no llega, usá `--ink-dim` ahí.

- [ ] **Step 3: Verificar que las tres pasan AA**

Volvé a medir los tres números del Step 1. Esperado: **≥4,5:1 en las tres**.

- [ ] **Step 4: Verificar que el cambio es sólo el esperado**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. La comparación de píxeles **va a dar distinto de cero en las tres** — es el único task de la rama donde eso es correcto. Confirmá que la diferencia está **acotada al pie** y no se filtró a otro lado.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/club/landing-footer.scss
git commit -m "fix(pie): el copyright sale de abajo de AA en las tres plantillas"
```

---

### Task 5: E entra al registry y al dispatcher

Con las deudas saldadas, empieza E. Primero existir: el catálogo ya la lista, pero `CODIGOS_CON_SHELL` no la incluye, así que hoy `shellDePlantilla('E')` la manda a la A.

**Files:**
- Create: `src/app/features/landing/shells/e-diurna/shell.ts`
- Create: `src/app/features/landing/shells/e-diurna/shell.html`
- Create: `src/app/features/landing/shells/e-diurna/shell.scss`
- Create: `src/app/features/landing/shells/e-diurna/_tokens.scss`
- Modify: `src/app/core/landing/plantillas.ts`
- Modify: `src/app/features/landing/landing.ts`
- Modify: `src/app/features/landing/landing.html`

**Interfaces:**
- Produces: componente con selector `app-shell-e`, host con clase `tpl-e`, y dos `output<void>()` — `abrirArrepentimiento` y `abrirPolitica` — igual que las otras tres cáscaras.

- [ ] **Step 1: Crear la cáscara con la estructura mínima**

`shell.html` — el esqueleto que E comparte con C (color arriba, contenido abajo), pero con **un solo panel** en vez de varias cards, que es la primera línea del contrato §6.1:

```html
<header class="e-campo">
  <div class="e-brandline">
    <app-brand-mark />
    <span class="e-brandname display">{{ tenantNombre() }}</span>
  </div>
  <h1 class="e-title display">Jugá hoy mismo.</h1>
</header>

<main class="e-panel">
  <section id="reservar" class="e-book" tabindex="-1">
    <app-booking-flow (abrirPolitica)="abrirPolitica.emit()" />
  </section>
</main>

<section id="e-info" class="e-info">
  <app-club-info />
</section>

<app-landing-footer class="e-foot"
  (abrirArrepentimiento)="abrirArrepentimiento.emit()" (abrirPolitica)="abrirPolitica.emit()" />
```

> El copy imperativo ("Jugá hoy mismo") es del contrato §6.1, que lo contrasta con el tono cercano de C ("¿Cuándo jugás?"). **Es una decisión del spec, no tuya.**

`shell.ts` — copiá la forma de `c-tarjeta/shell.ts` (mismos `imports`, mismos `output`, mismo `inject(ClubStore)`), cambiando selector, `host` y `templateUrl`/`styleUrl`. Y agregá la carga de fuentes, que en E es gratis porque reusa el par de B:

```ts
  private readonly doc = inject(DOCUMENT);

  constructor() {
    // E reusa el trío de B (spec §6), así que `cargarFuentes` es idempotente por URL y las dos
    // cáscaras comparten un solo <link> sin coordinarse.
    cargarFuentes(this.doc, urlFuentes(PLANTILLAS.E.fuentes));
  }
```

- [ ] **Step 2: Declarar los tokens del contrato**

`_tokens.scss` con **todos** los tokens que el flujo consume — el test del Task 1 te dice cuáles y falla si falta uno. Arrancá con los valores claros (los de A/C) para los que E no quiere diferenciar todavía; el vidrio llega en el Task 7.

- [ ] **Step 3: Enchufarla al dispatcher**

En `plantillas.ts`, agregar `'E'` a `CODIGOS_CON_SHELL`. En `landing.html`, agregar el `@case ('E') { <app-shell-e /> }` al `@switch`, con los mismos handlers que las otras. En `landing.ts`, sumar el componente a `imports`.

- [ ] **Step 4: Verificar que E renderiza y que las otras no se movieron**

```bash
npm test
npm run build
```

El test del contrato tiene que **incluir a E automáticamente** si lo escribiste leyendo el directorio; si tiene la lista de cáscaras hardcodeada, agregá `'e-diurna'`.

Levantá el front y abrí `http://demo.localhost:4400/?plantilla=E`: tiene que renderizar la cáscara de E (fea todavía, pero suya) y **no** la A.

```bash
npx playwright test e2e
```

Esperado: **20 passed**. Ojo con `preview.spec.ts`, que verifica qué códigos ofrece el selector de preview: ahora son cuatro.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/landing/ src/app/features/landing/
git commit -m "feat(plantilla-e): la cascara existe y el dispatcher la conoce"
```

---

### Task 6: El campo de color

La masa de E: un campo del color del club **a plena saturación** arriba, con el secundario como luz radial. Es lo que le da sustancia al vidrio del Task 7 — la spec §6 es explícita en que ninguna plantilla usa vidrio sobre blanco plano, y que ésa es la razón por la que la B vieja se veía lavada.

**Files:**
- Modify: `src/app/features/landing/shells/e-diurna/shell.scss`

- [ ] **Step 1: Pintar el campo**

```scss
/* El campo: el color del club a plena saturación arriba, con el secundario como luz radial (spec §6,
   rol del color en E). No es decorado — es lo que le da sustancia al vidrio del panel: sobre blanco
   plano el blur no tiene nada que difuminar, que es por qué la B vieja se veía lavada. */
.e-campo {
  background:
    radial-gradient(70% 90% at 78% 8%, color-mix(in srgb, var(--court-2, var(--court)) 55%, transparent), transparent 70%),
    var(--court);
  color: var(--ink-on-accent, #fff);
}
```

`--ink-on-accent` lo calcula la capa 3 contra el color del club, así que el texto del campo sale legible sin que la cáscara decida nada — es el mecanismo que la fase B arregló para que funcione con cualquier primario.

- [ ] **Step 2: Darle altura y que el panel se apoye en su borde**

El campo ocupa la parte de arriba; el panel del Task 7 va a montarse **a caballo de su borde inferior**, que es la firma de E. Reservá esa altura y dejá el panel con un margen negativo que lo suba sobre el borde. Los valores exactos son tuyos: lo que el spec fija es que el panel quede *a caballo*, no pegado abajo.

- [ ] **Step 3: Revisión en los cuatro anchos**

360 · 390 · 768 · 1280. Buscá que el campo no coma la pantalla en mobile —el flujo de reserva tiene que asomarse sobre el fold— y que el título en Anton no se deforme (si se ve estirado o engordado, los tokens del Task 3 no están llegando).

- [ ] **Step 4: Verificar y commitear**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**.

```bash
git add src/app/features/landing/shells/e-diurna/
git commit -m "feat(plantilla-e): el campo de color con la luz del secundario"
```

---

### Task 7: El panel de vidrio a caballo del borde — la firma

La firma de E según la spec §6: *el panel de vidrio a caballo del borde del color*. Y la primera línea del contrato §6.1: **un solo panel**, no varias cards apiladas como C.

**Files:**
- Create: `src/app/features/landing/shells/e-diurna/_vidrio.scss`
- Modify: `src/app/features/landing/shells/e-diurna/_tokens.scss`
- Modify: `src/app/features/landing/shells/e-diurna/shell.scss`

**Interfaces:**
- Produces: `@mixin vidrio-diurno($radio)` y `@mixin vidrio-diurno-tokens($radio)` en `e-diurna/_vidrio.scss`.

- [ ] **Step 1: Escribir la receta del vidrio claro**

**No reuses `b-nocturna/_vidrio.scss`.** Vive en el directorio de B y su receta es para fondo oscuro; parametrizarla con un argumento de claridad convertiría un archivo que dice pertenecer a B en compartido por la puerta de atrás. Si más adelante D también necesita vidrio, la receta sube a `shells/_vidrio.scss` deliberadamente.

E copia la **forma** de `_vidrio.scss` de B —variables Sass, dos mixins, uno emitiendo declaraciones y otro emitiendo los tokens `--flow-*`— con valores propios. Del contrato §6.1: **radio 18px y borde especular**, contra los radios 20-26px y sombras suaves de C.

```scss
/* ===================================================================
   El vidrio diurno: el panel apoyado a caballo del borde del campo de color.

   Misma forma que el vidrio de la nocturna (variables + dos mixins, uno para declaraciones y otro
   para los tokens --flow-*) pero receta propia: acá el vidrio se apoya sobre color saturado, no
   sobre noche, así que el borde es especular y no luminoso.

   NO se comparte con `b-nocturna/_vidrio.scss`: esa receta es para fondo oscuro y vive en el
   directorio de B. Si D también necesita vidrio, la receta sube a `shells/_vidrio.scss` a propósito.
   =================================================================== */
$superficie: color-mix(in srgb, var(--surface) 78%, transparent);
$desenfoque: blur(20px) saturate(1.3);
/* Especular, no luminoso: sobre color saturado el borde es un reflejo del blanco del panel, no un
   halo. Por eso va casi opaco arriba y se apaga — al revés que el rim uniforme de la nocturna. */
$borde: 1px solid color-mix(in srgb, #fff 85%, transparent);
$sombra: 0 18px 40px -24px rgba(15, 23, 42, 0.35),
  inset 0 1px 0 color-mix(in srgb, #fff 70%, transparent);
```

> **Estos valores son un punto de partida medido contra el campo, no dogma.** Ajustalos mirando: el
> vidrio tiene que leerse como vidrio sobre la mitad de arriba (donde hay color detrás) *y* seguir
> teniendo cuerpo sobre la mitad de abajo (donde hay papel). Si al subir el `$superficie` desaparece
> sobre el papel, o al bajarlo tapa el color, todavía no está. **Anotá en el reporte con qué valores
> terminaste y qué te hizo moverte de éstos** — el próximo shell con vidrio va a leer eso.

- [ ] **Step 2: Consumirlo desde los tokens y desde el panel**

`_tokens.scss` incluye `vidrio-diurno-tokens(18px)`, igual que B hace con el suyo. El test del Task 1 sigue el `@include`, así que va a contarlos bien.

- [ ] **Step 3: Montarlo a caballo del borde**

El panel sube sobre el campo con margen negativo. Lo que hay que cuidar: que el vidrio tenga **color detrás en su mitad de arriba y superficie clara en la de abajo** — eso es lo que hace la firma. Si queda enteramente sobre el color, o enteramente debajo, no es E.

- [ ] **Step 4: Verificar la diferenciación contra C**

Abrí las dos al lado, en 390 y 1280:

```
http://urbanpadel.localhost:4400/     → C
http://demo.localhost:4400/?plantilla=E   → E
```

Contra el contrato §6.1, punto por punto: contenedor (varias cards opacas vs **un solo** panel de vidrio), tipografía (Outfit redonda minúscula vs **Anton condensada mayúscula**), forma (radios 20-26px y sombras suaves vs **radio 18px y borde especular**), CTA (barra anclada abajo vs **dentro del flujo**), tono del copy.

**Si al mirarlas parecen primas, el task no está terminado**, aunque cada valor individual sea el del contrato.

- [ ] **Step 5: Verificar y commitear**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**.

```bash
git add src/app/features/landing/shells/e-diurna/
git commit -m "feat(plantilla-e): el panel de vidrio a caballo del borde del campo"
```

---

### Task 8: Contraste de E

E es clara, así que no hereda los problemas de la capa oscura — pero tiene uno propio que ninguna plantilla anterior tuvo: **texto sobre el color del club a plena saturación**, en el campo.

**Files:**
- Create: `src/app/features/landing/shells/e-diurna/contraste.spec.ts`
- Modify: `src/app/features/landing/shells/e-diurna/shell.scss` *(si el audit encuentra algo)*

- [ ] **Step 1: Escribir el spec leyendo la hoja**

Copiá la forma de `b-nocturna/contraste.spec.ts` — que lee los valores de los `.scss` en vez de duplicarlos, que es lo que lo hace un tripwire y no una copia que se desincroniza. **Arreglá al copiar** los tres parsers frágiles que la review de B dejó anotados: el guard de `//` tiene que correr **después** de sacar los comentarios de bloque; el regex de `color-mix` necesita el flag `s` para valores partidos en varias líneas; y el del bloque `:focus-visible` tiene que estar anclado, no tomar el primer match.

- [ ] **Step 2: Medir el texto sobre el campo con los cuatro colores**

Con la config stubeada en `plantilla: 'E'`. Medí el título, la marca y cualquier texto del campo contra `#FFD400`, `#FF2D95`, `#111111` y `#0a8a99`.

Esperado: **≥4,5:1 para texto corriente**, o el texto se mueve fuera del color crudo — que es la regla de diseño de la spec §10, no una opción.

- [ ] **Step 3: El recorrido por teclado**

Tab desde arriba, anotando cada parada. Sobre el campo saturado el anillo de foco por defecto puede desaparecer igual que desaparecía sobre el fondo oscuro de B. Si hace falta uno propio, **es la misma decisión que B tomó** y conviene que sea el mismo mecanismo.

- [ ] **Step 4: Verificar y commitear**

```bash
npm test
npm run build
npx playwright test e2e
```

```bash
git add src/app/features/landing/shells/e-diurna/
git commit -m "test(plantilla-e): pinea el contraste sobre el campo de color"
```

---

### Task 9: La puerta de la fase

La spec §11 fija la puerta de cada cáscara: *reserva completa e2e en su tenant + revisión visual en los 4 anchos*. E no tiene tenant todavía.

**Files:**
- Modify: `e2e/plantillas.spec.ts`

- [ ] **Step 1: Agregar el tenant de E a la matriz del spec**

`plantillas.spec.ts` ya provisiona sus tenants por la API de plataforma si no existen (mirá su `beforeAll`). Agregá `{ slug: 'solpadel', nombre: 'Sol Pádel', tpl: 'E', shell: '.tpl-e' }` a la matriz. El helper `reservar()` **no se toca**: que el mismo helper funcione en las cuatro plantillas es exactamente lo que prueba que el flujo único sobrevive a las pieles.

> **Esta es la única edición autorizada a un spec e2e en todo el plan**, y es agregar una fila a una matriz, nunca relajar una aserción. La suite pasa de 20 a 21 tests.

- [ ] **Step 2: Correr y verificar**

```bash
npx playwright test e2e/plantillas.spec.ts
```

Esperado: **4 passed**. Si el de E falla en el provisioning, revisá que el back acepte `E` — lo hace desde el PR del back, así que si no, es que esa rama no está en tu base.

- [ ] **Step 3: Revisión visual de E en los cuatro anchos**

360 · 390 · 768 · 1280, con un horario elegido para que se vea el estado seleccionado. Verificá: el campo de color con la luz del secundario; el panel **a caballo** del borde; Anton sin deformar; nada ilegible sobre el color; y el contraste con C fresco en la cabeza.

- [ ] **Step 4: La comparación acumulada**

Contra el commit anterior al Task 1, con el procedimiento de server fresco por estado.

Esperado: **A, B y C en 0 px salvo el pie**, que el Task 4 movió a propósito en las tres. Cualquier otra diferencia es una regresión.

- [ ] **Step 5: Verificar todo y commitear**

```bash
npm test
npm run build
npx playwright test e2e
```

Esperado: **21 passed**.

```bash
git add e2e/plantillas.spec.ts
git commit -m "test(plantilla-e): el e2e reserva de punta a punta en la diurna"
```

---

## Cierre de la fase E

Con los nueve tasks: el contrato `--flow-*` tiene quién lo haga cumplir, el color del club se adapta a la superficie de cada cáscara, `.display` ya no hardcodea los ejes de una fuente, el © del pie está sobre AA en todas las plantillas, y E existe — clara, con su campo de color y su panel de vidrio a caballo del borde.

**Qué NO cambió y es correcto:** C y D siguen sin rediseño (C está agendada después de E, D al final), la galería del panel sigue siendo un `<select>` y marketing sigue sin la sección de personalización.

**Antes de empezar la plantilla C**, verificar:
- `npx playwright test e2e` → 21 passed, con los specs sin relajar.
- `npm test` verde, incluidos el contrato `--flow-*` y los dos specs de contraste.
- `npm run build` verde, sin warnings de budget.
- Las capturas de E en los cuatro anchos, revisadas contra el contrato §6.1 al lado de C.
- A, B y C sin diferencias contra el inicio de la rama salvo el pie.

**Lo que E le deja a C y a D:** el contrato ya es una puerta, así que sus autores se enteran de un token faltante por un test rojo y no por una plantilla que se ve "casi bien". Los ejes de `.display` son tokens, así que C (Outfit) y D (IBM Plex Sans) los pisan en su `:host` en vez de agregar una neutralización. Y si D necesita vidrio, la decisión ya está escrita: la receta sube a `shells/_vidrio.scss` deliberadamente, no se parametriza la de otra plantilla.
