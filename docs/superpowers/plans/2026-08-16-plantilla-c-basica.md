# Plantilla C · Básica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que C deje de ser una plantilla de escritorio con rail lateral llamada "Tarjeta", y pase a ser **la Básica**: una sola columna, hairlines, el color del club como **lomo** — y la plantilla por defecto del producto.

**Architecture:** la cáscara `c-tarjeta/` se reescribe entera (HTML, hoja, tokens) pero **conserva su carpeta, su selector y su `claseShell: 'tpl-c'`**, así nada de lo que la referencia desde afuera se entera. El cambio de default toca tres puntos del registry/dispatcher y va **después** de una migración de datos que le escribe `'A'` explícito a los tenants que ya existen, para que a ningún club real le cambie la página.

**Tech Stack:** Angular 21 standalone + signals + SSR · SCSS con el sistema de tres capas de tokens · Vitest · Playwright · Flyway (back) · MySQL.

**Spec:** `docs/superpowers/specs/2026-08-16-plantilla-c-basica-design.md`. Cuando este plan y la spec no coincidan, manda la spec.

## Global Constraints

- Comentarios, nombres de símbolos y mensajes de commit **en español**.
- **Sin dependencias nuevas** y **sin familias tipográficas nuevas**: C sigue con **Outfit + Inter**.
- **El sistema de tres capas** (spec vieja §5.1): la capa 2 (la cáscara) nunca declara `--court*`; la capa 3 nunca declara superficie ni tinta. C **consume** el color y **declara** su superficie/tinta.
- **Ninguna cáscara apunta al DOM del flujo.** Lo que C necesite del `<app-booking-flow>` sale por tokens `--flow-*`.
- **Contraste**: 4,5:1 texto chico · 3:1 texto grande/negrita y componentes. El límite de "grande" es 24px = 18pt.
- **C no usa el primario como masa.** Es lo único que la hace distinta de las otras tres, y no se negocia.
- **A, B y E no se tocan.** Las únicas excepciones son un comentario en `booking-flow.scss` (Task 2) y el bloque `:host(.c-foot)` de la hoja del pie (Task 6).

## Cómo correr las cosas (trampas ya pagadas con horas)

- Unit: **`npm test` pelado**. `npm test -- --filter <archivo>` corre **cero tests y sale verde**; `npx vitest run <path>` dice "no tests". Las dos son falsos verdes.
- Build: `npm run build`. Presupuesto de warning en 550 kB.
- E2E: **`npx playwright test e2e`, siempre con el path**. Pelado escanea `src/`, `.claude/` y el proyecto hermano BarberApp y corrompe el runner. Y **matar cualquier `ng serve` propio en 4400 antes**: Playwright levanta el suyo con `reuseExistingServer: false`.
- Stack: MySQL es el contenedor `padel-mysql` (**3308 → 3306**). El back desde `padelBack`:
  ```
  PORT=8095 DB_URL='jdbc:mysql://localhost:3308/padeldb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC' SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
  ```
- **Una media query escrita ANTES de su regla base pierde en silencio** (misma especificidad, gana la de abajo). Pasó tres veces en la sesión anterior. Las reglas de pantalla angosta van **al final del archivo**.
- **Un radio o checkbox oculto necesita caja.** `width/height: 0` no se puede clickear; va `position: absolute; inset: 0; z-index: 1; opacity: 0`. El `z-index` no es opcional si arriba hay algo posicionado.
- **Probar toda puerta en rojo.** Un test que nunca se vio fallar no es una puerta.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `padelBack/src/main/resources/db/migration/V11__plantilla_explicita.sql` | congela la plantilla de los tenants que ya existen | 1 |
| `src/app/core/landing/plantillas.ts` | el registry: nombre de C y las dos funciones que caen en la default | 2 |
| `src/app/features/landing/landing.html` | el `@default` del dispatcher | 3 |
| `src/app/features/landing/shells/c-tarjeta/shell.html` | la estructura nueva: una columna | 4 |
| `src/app/features/landing/shells/c-tarjeta/shell.scss` | la hoja: columna, hairlines y el lomo | 4 y 5 |
| `src/app/features/landing/shells/c-tarjeta/_tokens.scss` | el contrato `--flow-*` de C | 6 |
| `src/app/features/landing/club/club-info.scss` | sacar la regla del rail | 4 |
| `src/app/features/landing/club/landing-footer.scss` | el hover del pie de C | 6 |
| `src/app/features/landing/shells/c-tarjeta/contraste.spec.ts` | el contraste pineado contra las hojas | 7 |
| `e2e/plantillas.spec.ts` · `e2e/plataforma.spec.ts` | las puertas de punta a punta | 8 |

---

### Task 1: La migración · `'A'` explícito para los tenants que ya existen

**Va primero, y el orden importa.** Si la default se mueve antes de esto, cualquier club que hoy no eligió plantilla se despierta con otra página. Después de esta migración, el cambio de default aplica **sólo a clubes nuevos**.

**Files:**
- Create: `padelBack/src/main/resources/db/migration/V11__plantilla_explicita.sql`

**Interfaces:**
- Consume: la tabla `tenants`, columna `plantilla` (creada en `V10__plantilla.sql`).
- Produce: ningún tenant existente queda con `plantilla` nula o vacía.

- [ ] **Step 1: Ver el estado actual, para saber a cuántos afecta**

Run:
```bash
docker exec padel-mysql mysql -uroot -proot padeldb -e "SELECT slug, plantilla FROM tenants ORDER BY slug;"
```
Expected: la lista de tenants de desarrollo. Anotar cuáles tienen `plantilla` en `NULL` o `''` — ésos son los que la migración toca.

- [ ] **Step 2: Escribir la migración**

Crear `padelBack/src/main/resources/db/migration/V11__plantilla_explicita.sql`:

```sql
-- Congela la plantilla de los clubes que YA EXISTEN antes de que la default del producto pase de A
-- a C (ver docs/superpowers/specs/2026-08-16-plantilla-c-basica-design.md, seccion 5.2).
--
-- Sin esto, un club que nunca eligio plantilla esta viendo A por el fallback del front, y el dia que
-- la default cambie le cambia la pagina publica sin que haya tocado nada. Con esto, el cambio de
-- default aplica SOLO a clubes nuevos.
--
-- Es idempotente a proposito: si se corre dos veces no pisa a nadie que ya haya elegido.
UPDATE tenants
   SET plantilla = 'A'
 WHERE plantilla IS NULL
    OR TRIM(plantilla) = '';
```

- [ ] **Step 3: Aplicarla y verificar**

Levantar el back (Flyway corre las migraciones al arrancar):
```bash
PORT=8095 DB_URL='jdbc:mysql://localhost:3308/padeldb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC' SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

Con el back arriba:
```bash
docker exec padel-mysql mysql -uroot -proot padeldb -e "SELECT COUNT(*) AS sin_plantilla FROM tenants WHERE plantilla IS NULL OR TRIM(plantilla) = '';"
```
Expected: **`sin_plantilla` = 0**.

Y que Flyway la registró:
```bash
docker exec padel-mysql mysql -uroot -proot padeldb -e "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;"
```
Expected: `11 · plantilla explicita · 1`.

- [ ] **Step 4: Commit**

```bash
git add padelBack/src/main/resources/db/migration/V11__plantilla_explicita.sql
git commit -m "feat(tenants): congela la plantilla de los clubes existentes antes de mover la default"
```

---

### Task 2: El registry · C se llama Básica y es la default

**Files:**
- Modify: `src/app/core/landing/plantillas.ts`
- Modify: `src/app/core/landing/plantillas.spec.ts`
- Modify: `src/app/features/landing/booking/booking-flow.scss` (sólo un comentario)

**Interfaces:**
- Produce: `normalizarPlantilla(x)` devuelve `'C'` para cualquier valor que el catálogo no conozca; `shellDePlantilla(x)` devuelve `'C'` para un código sin cáscara. `PLANTILLAS.C.nombre === 'Básica'`.

- [ ] **Step 1: Escribir los tests en rojo**

En `plantillas.spec.ts`, reemplazar las tres aserciones de `normalizarPlantilla` (hoy líneas 76-78) y sumar las de `shellDePlantilla`:

```ts
  it('lo que el catálogo no conoce cae en la DEFAULT, que hoy es C', () => {
    // La default dejó de ser A el 2026-08-16 (spec de la plantilla C básica, §5.1). Este test es el
    // que lo dice: si alguien la mueve de vuelta sin querer, acá se entera.
    expect(normalizarPlantilla('Z')).toBe('C');
    expect(normalizarPlantilla(null)).toBe('C');
    expect(normalizarPlantilla('')).toBe('C');
    expect(normalizarPlantilla(undefined)).toBe('C');
  });

  it('un código que existe pero no tiene cáscara también cae en C', () => {
    // 'D' está en el catálogo (el back la acepta) y no tiene cáscara: se dibuja la default.
    expect(shellDePlantilla('D')).toBe('C');
    expect(shellDePlantilla(null)).toBe('C');
  });

  it('C se llama Básica y no Tarjeta', () => {
    // El nombre viejo describía una plantilla de cards apiladas que el owner descartó. Ofrecerle al
    // dueño "Tipo app, para el pulgar" y darle otra cosa era el problema que abrió esta fase.
    expect(PLANTILLAS.C.nombre).toBe('Básica');
    expect(PLANTILLAS.C.descripcion).toBe('Sobria, el color justo');
  });
```

Verificar que `shellDePlantilla` esté importado en el spec; si no, agregarlo al import de `./plantillas`.

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL**, con `expected 'A' to be 'C'` en los dos primeros y `expected 'Tarjeta' to be 'Básica'` en el tercero.

- [ ] **Step 3: Mover la default y renombrar C**

En `plantillas.ts`, la fila de C:

```ts
  C: { codigo: 'C', nombre: 'Básica',   descripcion: 'Sobria, el color justo',    esquema: 'light', fuentes: ['Outfit', 'Inter'],                          claseShell: 'tpl-c' },
```

`normalizarPlantilla`:

```ts
/**
 * Normaliza a un código válido; cualquier cosa rara cae en la plantilla por defecto.
 *
 * LA DEFAULT ES C DESDE EL 2026-08-16, y antes era A. El cambio es de producto, no de código: C es
 * la sobria, la que le sirve a un club que no quiere elegir. A los tenants que ya existían se les
 * escribió `'A'` explícito en la base antes de mover esto (migración `V11__plantilla_explicita.sql`),
 * así que este cambio sólo alcanza a los clubes nuevos.
 */
export function normalizarPlantilla(v: string | null | undefined): CodigoPlantilla {
  const up = (v ?? '').trim().toUpperCase();
  return CODIGOS_PLANTILLA.some((c) => c === up) ? (up as CodigoPlantilla) : 'C';
}
```

Y en `shellDePlantilla`, el return final:

```ts
  return CODIGOS_CON_SHELL.some((c) => c === codigo) ? codigo : 'C';
```

Actualizar también el docblock de `shellDePlantilla`, que hoy dice *"a un tenant en D le devuelve 'A'"* → `'C'`.

- [ ] **Step 4: Corregir el comentario del contrato `--flow-*`**

En `booking-flow.scss`, donde dice que el fallback de cada token es "el valor de la plantilla A", el valor **no cambia** (spec §5.3) pero la redacción se vuelve confusa ahora que la default es otra. Reemplazar esa frase por:

```
   Cada token trae como fallback el valor de la plantilla A, así una cáscara que se olvide de
   declarar uno se ve como la A en ese aspecto en vez de romperse.

   OJO CON UNA CONFUSIÓN FÁCIL: ese fallback es "el valor de la A", NO "el valor de la plantilla por
   defecto". Desde el 2026-08-16 la default del producto es C y estos fallbacks siguen siendo los de
   A a propósito — protegen a una cáscara que se olvidó de declarar un token, que es un problema
   distinto de cuál plantilla se dibuja cuando el club no eligió ninguna.
```

- [ ] **Step 5: Verde**

Run: `npm test`
Expected: **PASS**. Ojo: es probable que caigan otros tests que asumían A. Arreglarlos **leyendo qué afirmaba cada uno** — si un test decía "un tenant en D se dibuja como A", ahora dice C y sigue siendo correcto; si alguno afirma otra cosa, puede estar señalando algo real.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/landing/ src/app/features/landing/booking/booking-flow.scss
git commit -m "feat(plantillas): C se llama Basica y pasa a ser la plantilla por defecto"
```

---

### Task 3: El dispatcher · el `@default` dibuja C

**Files:**
- Modify: `src/app/features/landing/landing.html`
- Modify: `src/app/features/landing/landing.spec.ts`

- [ ] **Step 1: Escribir el test en rojo**

En `landing.spec.ts` están las tres aserciones que hoy buscan `app-shell-a` (líneas 116, 122, 128). Cambiarlas a C y explicar el porqué en el test que cubre el caso de D:

```ts
    // Un tenant en una plantilla sin cáscara (D) se dibuja con la DEFAULT, que desde el 2026-08-16
    // es C. El host publica `data-tpl="C"` y no 'D': si publicara su propio código, las reglas de
    // layout que enganchan por `[data-tpl]` no aplicarían. Ver shellDePlantilla().
    expect(host.querySelector('app-shell-c')).not.toBeNull();
    expect(host.querySelector('app-shell-a')).toBeNull();
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** — `expected null not to be null` sobre `app-shell-c`, porque el `@default` todavía dibuja A.

- [ ] **Step 3: Mover el `@default`**

En `landing.html`, el `@switch` pasa a tener un `@case ('A')` explícito y C en el `@default`:

```html
@switch (plantilla()) {
  @case ('A') {
    <app-shell-a (abrirArrepentimiento)="abrirArrepentimiento()" (abrirPolitica)="abrirPolitica()" />
  }
  @case ('B') {
    <app-shell-b (abrirArrepentimiento)="abrirArrepentimiento()" (abrirPolitica)="abrirPolitica()" />
  }
  @case ('E') {
    <app-shell-e (abrirArrepentimiento)="abrirArrepentimiento()" (abrirPolitica)="abrirPolitica()" />
  }
  @default {
    <app-shell-c (abrirArrepentimiento)="abrirArrepentimiento()" (abrirPolitica)="abrirPolitica()" />
  }
}
```

Y actualizar el comentario de arriba del `@switch`, que hoy dice *"un tenant en D llega acá como 'A'"* y *"El @default es la A, la plantilla por defecto"* → C en los dos lugares.

- [ ] **Step 4: Verde y build**

Run: `npm test` → **PASS**.
Run: `npm run build` → limpio.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/landing.html src/app/features/landing/landing.spec.ts
git commit -m "feat(landing): el dispatcher dibuja C cuando el club no eligio plantilla"
```

---

### Task 4: La cáscara · una sola columna, el rail afuera

El cambio que el dueño ve. **El rail se va**: era lo que hacía que C se sintiera panel de admin.

**Files:**
- Modify: `src/app/features/landing/shells/c-tarjeta/shell.html`
- Modify: `src/app/features/landing/shells/c-tarjeta/shell.scss`
- Modify: `src/app/features/landing/club/club-info.scss` (borrar la regla del rail)

**Interfaces:**
- Consume: `<app-brand-mark>`, `<app-club-info>`, `<app-booking-flow>`, `<app-landing-footer>` — los mismos de hoy, sin cambios de API.
- Produce: el host sigue publicando `claseShell: 'tpl-c'`; **`.c-brandline` sobrevive** (ahora como clase del encabezado, no como fila del rail), así la regla de `brand-mark.ts:55-57` sigue valiendo tal cual.

- [ ] **Step 1: El HTML nuevo**

Reemplazar `shell.html` entero:

```html
<!-- C · BÁSICA. Una sola columna, la misma en todos los anchos: marca, reserva, info, pie.
     El rail lateral se fue — en escritorio eran dos columnas con una barra fija de 280px y se leía
     como un panel de administración, no como la página que un club le muestra a un jugador.
     `.c-brandline` sobrevive del layout viejo a propósito: `brand-mark.ts` tiene una regla
     `:host-context(.c-brandline)` que fija el tamaño del logo, y así sigue valiendo sin mudarla. -->
<header class="c-head">
  <div class="c-brandline">
    <app-brand-mark />
    <span class="c-brandname display">{{ tenantNombre() }}</span>
  </div>
</header>

<main class="c-main">
  <section id="reservar" class="c-book" tabindex="-1">
    <app-booking-flow (abrirPolitica)="abrirPolitica.emit()" />
  </section>

  <section id="c-info" class="c-info">
    <app-club-info />
  </section>
</main>

<app-landing-footer class="c-foot"
  (abrirArrepentimiento)="abrirArrepentimiento.emit()" (abrirPolitica)="abrirPolitica.emit()" />
```

- [ ] **Step 2: La hoja nueva (sin el lomo todavía — eso es la Task 5)**

Reemplazar `shell.scss` entero:

```scss
/* ==================================================================================================
   PLANTILLA C · BÁSICA

   La sobria del catálogo, y desde el 2026-08-16 la plantilla POR DEFECTO: la que le toca a un club
   que no quiere elegir. Blanco, hairlines, cero decoración.

   EL COLOR DEL CLUB NO ES MASA ACÁ, y ésa es su identidad. Entra sólo como el LOMO (la banda del
   borde, ver más abajo) y como acento en lo que el visitante toca. Es la única de las cuatro que no
   usa el primario como bloque: A lo pone de masa a la izquierda, B tiñe el telón, E arma un campo
   entero. Si algún día C llena algo grande de color, deja de ser C.

   UNA SOLA COLUMNA, LA MISMA EN TODOS LOS ANCHOS. No hay `display: contents` ni reordenamientos por
   breakpoint como en A y en la C vieja: la estructura de escritorio y la de teléfono son la misma y
   sólo cambian las medidas. Es lo que hace de C la cáscara más simple de mantener, y es a propósito
   —es la default: la que más veces se va a dibujar y la que menos tiene que sorprender.
   ================================================================================================== */
@use 'tokens';

:host {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  background: var(--paper);
  color: var(--ink);
}

/* El ancho de lectura. Todo lo que es contenido se alinea contra esta misma medida, así la página
   tiene una sola columna óptica de arriba abajo. */
.c-head,
.c-main,
.c-foot {
  width: 100%;
  max-width: 860px;
  margin-inline: auto;
  padding-inline: clamp(18px, 4vw, 32px);
}

.c-head {
  padding-block: clamp(20px, 3vw, 34px) clamp(16px, 2.5vw, 26px);
}

.c-brandline {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

/* `anywhere` para que un nombre de una sola palabra larguísima corte en vez de desbordar. */
.c-brandname {
  min-width: 0;
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.15;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.c-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(26px, 4vw, 44px);
  padding-bottom: clamp(28px, 4vw, 48px);
}

.c-book { scroll-margin-top: 16px; }

/* La info del club, abajo de la reserva: la reserva es a lo que el visitante vino. */
.c-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  scroll-margin-top: 16px;
}

.c-foot {
  padding-block: 20px clamp(22px, 3vw, 34px);
  border-top: 1px solid var(--line);
  color: var(--ink-faint);
}
```

- [ ] **Step 3: Borrar la regla del rail en la hoja compartida**

En `club/club-info.scss`, la línea 60 apunta a una clase que ya no existe:

```scss
  :host-context(.c-rail) .ic-hours li { flex-direction: column; align-items: flex-start; gap: 2px; }
```

Borrarla. El horario vuelve a su disposición normal, que es la correcta ahora que la info no vive en una columna de 280px.

Verificar que no quede ninguna otra referencia:
```bash
grep -rn "c-rail" src/
```
Expected: **cero resultados**.

- [ ] **Step 4: Los otros dos acoplamientos de la spec §7**

**`club-info.scss:54-55`** le da a las tarjetas de info de C radio 14px y un fondo de ícono al 10% del
color:

```scss
:host-context(.tpl-c) .ic-card { border-radius: 14px; }
:host-context(.tpl-c) .ic-ic { background: color-mix(in srgb, var(--court) 10%, transparent); }
```

`.tpl-c` **sobrevive** (es `claseShell`), así que las reglas siguen aplicando. Lo que hay que decidir
es si siguen teniendo sentido: **el radio de 14px se queda** (es coherente con "hairlines y formas
sobrias") y **el fondo del ícono también** — un 10% no es masa, es acento, que es justo el rol que C
le da al color. **No se tocan**, pero quedó mirado a propósito y no por omisión.

**`booking-flow.ts:18`** menciona `.tpl-c .flow-head .mono` como una regla histórica que apuntaba al
DOM del flujo desde afuera. Verificar que efectivamente ya no exista:

```bash
grep -rn "flow-head" src/app/features/landing/shells/
```
Expected: **cero resultados**. Si aparece algo, sale — ninguna cáscara apunta al DOM del flujo.

- [ ] **Step 5: Verde**

Run: `npm test` → **PASS**.
Run: `npm run build` → limpio.

- [ ] **Step 6: Mirarlo**

Con el stack arriba, abrir `http://urbanpadel.localhost:4400/` (el tenant de C) a **1280, 768 y 390**. Lo que hay que ver: una sola columna centrada, sin barra lateral, el pie separado por su hairline. Todavía **sin lomo** — eso es la tarea que sigue.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/landing/shells/c-tarjeta/ src/app/features/landing/club/club-info.scss
git commit -m "feat(plantilla-c): una sola columna, se va el rail que la hacia sentir panel de admin"
```

---

### Task 5: El lomo · la firma, con su piso de contraste medido

**Files:**
- Modify: `src/app/features/landing/shells/c-tarjeta/shell.scss`
- Create: `.superpowers/sdd/medir-lomo-c.mjs` (banco de medición, no se embarca)

**Interfaces:**
- Produce: los tokens `--c-lomo-ancho` y `--c-lomo-color` en el `:host` de C. El segundo es el que la Task 7 pinea.

- [ ] **Step 1: Entender la restricción antes de elegir el color**

El lomo es la firma, así que **no puede desaparecer con ningún club**. Una banda de `--court` crudo sobre `--paper` con un club casi blanco queda invisible — es exactamente lo que le pasó al campo de la plantilla D y lo que la hizo fracasar.

La receta es la misma que resolvió las líneas de D: el color del club **llevado hacia la tinta** lo justo para garantizar un piso contra el papel. El porcentaje **se mide**, no se elige a ojo.

- [ ] **Step 2: Escribir el banco de medición**

Crear `.superpowers/sdd/medir-lomo-c.mjs`:

```js
/**
 * Cuánto hay que llevar el color del club hacia la tinta para que el lomo de C se vea con CUALQUIER
 * club. El peor caso es el club casi blanco: sobre `--paper` (#f4f6fb) un `--court` crudo casi
 * desaparece. Se busca el porcentaje MÍNIMO de `--court` que deja las seis paletas por encima de 3:1
 * (WCAG 1.4.11, límite de un componente — el lomo es un elemento gráfico, no texto).
 */
const PAPER = '#f4f6fb';
const INK = '#10151f';

/** Las seis de siempre. No inventar una paleta nueva. */
const CLUBES = [
  ['teal de plataforma', '#0a8a99'],
  ['naranja del demo', '#f97316'],
  ['amarillo', '#ffd400'],
  ['casi blanco', '#fafafa'],
  ['casi negro', '#111111'],
  ['fucsia', '#ff2d95'],
];

const canales = (hex) => {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `color-mix(in srgb, A pct%, B)` se interpola en sRGB por canal, sin gamma. */
const mezcla = (a, b, pct) =>
  canales(a).map((ca, i) => Math.round(ca * pct + canales(b)[i] * (1 - pct)));

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (x, y) => {
  const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
};

console.log('pct de --court | peor club | peor ratio contra el papel');
for (let pct = 100; pct >= 20; pct -= 5) {
  const medidos = CLUBES.map(([nombre, hex]) => [nombre, ratio(mezcla(hex, INK, pct / 100), canales(PAPER))]);
  const peor = medidos.reduce((a, b) => (b[1] < a[1] ? b : a));
  console.log(`${String(pct).padStart(3)}% | ${peor[0].padEnd(20)} | ${peor[1].toFixed(2)} ${peor[1] >= 3 ? '✔' : '✘'}`);
}
```

- [ ] **Step 3: Correr la medición y elegir el porcentaje**

Run: `node .superpowers/sdd/medir-lomo-c.mjs`

Elegir **el porcentaje más alto que deja el peor club por encima de 3,00** — más alto es mejor, porque conserva más color del club. Anotar el número y el peor caso: van al comentario de la hoja y al spec de contraste de la Task 7.

- [ ] **Step 4: El lomo en la hoja**

Agregar al `:host` de `shell.scss`, después de las declaraciones de layout:

```scss
  /* ── EL LOMO · la firma de C ────────────────────────────────────────────────────────────────
     Una banda vertical delgada del color del club, pegada al borde izquierdo, de arriba abajo. Como
     el lomo de un libro. Es la firma porque cumple las tres cosas que una firma necesita acá: está
     siempre (todos los anchos, todo el scroll), no le come espacio al contenido —que es lo que
     "básica" pide— y no se pisa con ninguna otra (A es masa a la izquierda, B es telón oscuro con
     luz, E es campo de color arriba con vidrio a caballo).

     NO SE DIBUJA CON `--court` CRUDO, y esto es una restricción dura, no una preferencia: con un
     club casi blanco una banda del color crudo sobre `--paper` desaparece, y con ella desaparece lo
     único que hace a C ser C. Es el mismo modo de falla que hundió a la plantilla D. El color va
     llevado hacia la tinta hasta un piso medido de 3:1 contra el papel con las seis paletas de la
     casa (WCAG 1.4.11: el lomo es un elemento gráfico, no texto).
     PORCENTAJE MEDIDO: <PCT>% de `--court` — peor caso <CLUB>, <RATIO>:1. Pineado en
     `contraste.spec.ts`. Ver `.superpowers/sdd/medir-lomo-c.mjs` para reproducir la medición. */
  --c-lomo-ancho: clamp(6px, 0.8vw, 11px);
  --c-lomo-color: color-mix(in srgb, var(--court) <PCT>%, var(--ink));
```

Reemplazar `<PCT>`, `<CLUB>` y `<RATIO>` por lo medido en el Step 3.

Y la regla que lo dibuja, al final del bloque `:host`:

```scss
:host::before {
  content: '';
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--c-lomo-ancho);
  /* Degradado hacia su versión clara: le da al lomo la profundidad de un canto real sin agregar una
     segunda idea. `--court-2` cae al primario si el club no tiene secundario. */
  background: linear-gradient(
    180deg,
    var(--c-lomo-color),
    color-mix(in srgb, var(--court-2, var(--court)) 55%, var(--paper))
  );
  z-index: 3;
  pointer-events: none;
}
```

`position: fixed` y no `absolute`: el lomo tiene que acompañar todo el scroll, que es lo que lo hace lomo y no un borde de la primera pantalla.

- [ ] **Step 5: Que el contenido no quede debajo del lomo**

En el bloque de `.c-head, .c-main, .c-foot`, el `padding-inline` pasa a dejarle lugar:

```scss
  padding-inline: calc(var(--c-lomo-ancho) + clamp(14px, 3.5vw, 28px)) clamp(18px, 4vw, 32px);
```

- [ ] **Step 6: Verificarlo con los seis clubes**

Run: `npm test` → PASS · `npm run build` → limpio.

Con el stack arriba, abrir la landing con `?color=` para cada paleta y confirmar que **el lomo se ve en las seis**, sobre todo con el casi blanco:

```bash
http://urbanpadel.localhost:4400/?color=%23fafafa
```

- [ ] **Step 7: Commit**

```bash
git add src/app/features/landing/shells/c-tarjeta/shell.scss
git commit -m "feat(plantilla-c): el lomo, la firma de la basica, con su piso de contraste medido"
```

---

### Task 6: Las dos deudas medidas que viven en los archivos de C

Están registradas en `ESTADO-Y-PROXIMOS-PASOS.md` §5 y **se pagan acá**, porque están en el código que esta fase reescribe igual. El bloque de A en la hoja del pie **no se toca**: es otra deuda y otra fase.

**Files:**
- Modify: `src/app/features/landing/shells/c-tarjeta/_tokens.scss`
- Modify: `src/app/features/landing/club/landing-footer.scss` (sólo `:host(.c-foot)`)

- [ ] **Step 1: `--flow-soft-ink-accent`**

Hoy C lo declara con `var(--court-deep)`: **abajo de AA en 4 de 6 paletas**, y con el naranja del demo da **2,98:1**. La receta que sí funciona ya está medida en la fase D: `mix(--court 40%, --ink)`, techo 41,34%.

En `_tokens.scss` de C:

```scss
  /* La tinta de acento sobre el bloque suave (precio, aviso de seña). NO es `--court-deep`, que es lo
     que decía antes: medido contra el bloque suave, `--court-deep` queda abajo de AA en 4 de las 6
     paletas de la casa y da 2,98:1 con el naranja del club del demo — o sea que el precio, que es
     justo lo que el visitante viene a leer, no llegaba al mínimo.
     El 40% es un TECHO medido (41,34%): más color y el peor club se cae. */
  --flow-soft-ink-accent: color-mix(in srgb, var(--court) 40%, var(--ink));
```

- [ ] **Step 2: El hover del pie de C**

Hoy `:host(.c-foot) a:hover { color: var(--court-deep); }` — **abajo de AA en 3 de 6 paletas, y por debajo del estado normal en 5 de 6**: pasar el mouse *empeora* la legibilidad, que es lo contrario de lo que un hover significa.

```scss
/* El hover ACLARA la lectura, no la empeora. Antes iba a `--court-deep` crudo y con 5 de las 6
   paletas de la casa quedaba PEOR que el estado normal (`--ink-dim`): el visitante pasaba el mouse y
   el link se volvía más difícil de leer. Ahora va a la tinta plena, que siempre mejora contra el
   papel, y el color del club se reserva para el subrayado. */
:host(.c-foot) a:hover { color: var(--ink); text-decoration: underline; text-decoration-color: var(--court); }
```

- [ ] **Step 3: Verde**

Run: `npm test` → **PASS**. Ojo con `club/pie-por-cascara.spec.ts`, que exige que el bloque de pie declare `color` en reposo para los dos `<button>` — el cambio es sobre `a:hover` y no lo toca, pero hay que confirmarlo.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/landing/shells/c-tarjeta/_tokens.scss src/app/features/landing/club/landing-footer.scss
git commit -m "fix(plantilla-c): la tinta del bloque suave y el hover del pie, que estaban abajo de AA"
```

---

### Task 7: El contraste pineado contra la hoja

`c-tarjeta/contraste.spec.ts` ya existe y hay que **reescribirlo**: describía la C vieja. Lee las hojas **como texto** porque jsdom no aplica la cascada de hojas de componente — un `getComputedStyle` saldría verde siempre, y un tripwire que no puede fallar es peor que no tenerlo.

**Files:**
- Modify: `src/app/features/landing/shells/c-tarjeta/contraste.spec.ts`

- [ ] **Step 1: Reusar la maquinaria que el archivo ya tiene**

El spec actual ya trae `leerHoja()`, `declaracion()`, `hexDe()`, `colorMix()`, `rgb()`, `lum()` y `ratio()`, y la guardia que tira si una hoja tiene comentarios `//`. **No reescribirlas**: son las mismas de B y de E y están probadas. Lo que cambia son las mediciones.

- [ ] **Step 2: Escribir los tests nuevos**

```ts
/** Las seis paletas de la casa. Caracterizadas en `.superpowers/sdd/task-e8-report.md`. */
const CLUBES = ['#0a8a99', '#f97316', '#ffd400', '#fafafa', '#111111', '#ff2d95'];

describe('C · el lomo, que es la firma', () => {
  /** `--c-lomo-color: color-mix(in srgb, var(--court) N%, var(--ink))`, leído de la hoja. */
  const LOMO = colorMix(declaracion(HOJA_SHELL, '--c-lomo-color'), 'shell.scss · --c-lomo-color');

  it('se ve con las SEIS paletas, incluida la del club casi blanco', () => {
    // Es la restricción dura de la plantilla: si el lomo desaparece, C se queda sin lo único que la
    // hace C. Le pasó al campo de la plantilla D con este mismo club y la hundió.
    for (const club of CLUBES) {
      const r = ratio(mezcla(club, INK, LOMO.pct), rgb(PAPER));
      expect(r, `el lomo desaparece con el club ${club}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el porcentaje de la hoja es un TECHO: cinco puntos más y se cae', () => {
    // Sin esto el test de arriba pasaría con cualquier valor conservador, y nadie se enteraría de
    // que el lomo perdió color de más. Acá se afirma que el valor elegido está en el límite.
    const peorMas = Math.min(...CLUBES.map((c) => ratio(mezcla(c, INK, LOMO.pct + 0.05), rgb(PAPER))));
    expect(peorMas, 'el porcentaje no está en el techo: se puede subir sin romper').toBeLessThan(3);
  });

  it('el lomo NO se dibuja con el color crudo del club', () => {
    // La forma de romper esto sin querer es "simplificar" el color-mix a un var(--court) pelado.
    expect(declaracion(HOJA_SHELL, '--c-lomo-color')).toContain('color-mix');
    expect(declaracion(HOJA_SHELL, '--c-lomo-color')).not.toMatch(/^\s*var\(--court\)\s*$/);
  });
});

describe('C · el color no es masa (spec §6.1)', () => {
  it('la hoja no llena ninguna superficie grande con el color del club', () => {
    // Es EL contrato que separa a C de E. Las únicas apariciones de --court en la hoja de C son el
    // lomo y su degradado; si aparece un `background: var(--court)` a secas, C se volvió otra cosa.
    expect(HOJA_SHELL).not.toMatch(/background:\s*var\(--court\)\s*;/);
  });

  it('C declara su superficie y su tinta, y NUNCA un --court* (capa 2)', () => {
    expect(HOJA_SHELL).not.toMatch(/^\s*--court[a-z0-9-]*\s*:/m);
  });
});

describe('C · la tinta del bloque suave, que estaba abajo de AA', () => {
  const SUAVE_INK = colorMix(declaracion(HOJA_TOKENS, '--flow-soft-ink-accent'), '_tokens.scss · --flow-soft-ink-accent');

  it('llega a 4,5:1 con las seis paletas', () => {
    // Antes era `--court-deep` crudo: 2,98:1 con el naranja del club del demo, y el precio es lo que
    // el visitante viene a leer.
    for (const club of CLUBES) {
      const r = ratio(mezcla(club, INK, SUAVE_INK.pct), rgb(SURFACE));
      expect(r, `la tinta del bloque suave falla con ${club}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

`mezcla()` es la misma función del banco de la Task 5; si el spec no la tiene, agregarla al lado de `ratio()` con el mismo cuerpo.

- [ ] **Step 3: Probar cada puerta EN ROJO**

Una por una, romper y confirmar que el test correspondiente falla. **Elegir bien la rotura**: sobre superficie clara, la rotura va hacia el color crudo del club.

| puerta | rotura que la tiene que poner en rojo |
|---|---|
| el lomo se ve con las seis | subir el `%` de `--c-lomo-color` a 100 (color crudo) |
| el porcentaje es un techo | bajarlo 20 puntos |
| no es color crudo | reemplazar el `color-mix` por `var(--court)` |
| el color no es masa | agregar `background: var(--court);` a `.c-main` |
| la tinta del bloque suave | volver `--flow-soft-ink-accent` a `var(--court-deep)` |

Después de cada prueba, **revertir**.

- [ ] **Step 4: Verde**

Run: `npm test` → **PASS**, con el total anotado.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/shells/c-tarjeta/contraste.spec.ts
git commit -m "test(plantilla-c): el lomo y la tinta del bloque suave, pineados contra la hoja"
```

---

### Task 8: Las puertas de punta a punta

**Files:**
- Modify: `e2e/plantillas.spec.ts` (sumar la firma)
- Modify: `e2e/plataforma.spec.ts` (el alta de club sale en C)

- [ ] **Step 1: Correr la suite ANTES de tocarla**

Run: `npx playwright test e2e`

**Lo más probable es que pase entera, y eso está bien.** La fila de C es
`{ slug: 'urbanpadel', nombre: 'Urban Pádel', tpl: 'C', shell: '.tpl-c' }`: apunta a la **clase del
host**, que sobrevive al rediseño porque es `claseShell` en el registry. Ningún selector del e2e
toca `.c-rail`.

Si algo falla igual, leer el error antes de cambiar nada: estaría diciendo algo real sobre las tareas
anteriores, no sobre este archivo.

- [ ] **Step 2: Sumar la firma, que antes no se podía verificar porque no existía**

En la fila de C de `plantillas.spec.ts`, después de las aserciones de layout:

```ts
  // El lomo es la firma de C: si no está, la plantilla perdió lo único que la hace distinta.
  const lomo = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-tpl="C"]')!, '::before');
    return { ancho: parseFloat(cs.width), pos: cs.position };
  });
  expect(lomo.ancho).toBeGreaterThan(4);
  expect(lomo.pos).toBe('fixed');
```

- [ ] **Step 3: La puerta de la default**

En `plataforma.spec.ts`, el test de alta de club ya crea un tenant. Agregarle, después del alta:

```ts
  // La default del producto es C desde el 2026-08-16 (spec de la plantilla C básica, §5.1). Un club
  // recién creado tiene que salir en C. No sirve buscar "un tenant sin plantilla": la migración
  // V11 le escribió 'A' explícito a todos los que ya existían, justamente para que a ninguno le
  // cambiara la página.
  await page.goto(`http://${slug}.localhost:4400/`);
  await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'C', { timeout: 10_000 });
```

`slug` es la variable que ese test ya declara en su línea 27 (`e2eplat${Date.now().toString().slice(-6)}`); no hace falta inventar ninguna.

**Ojo con el orden:** el alta de club de ese test termina **borrando** el tenant que creó. La
aserción va **antes** del borrado, no después.

- [ ] **Step 4: Verde, dos veces**

Run: `npx playwright test e2e`
Expected: **todo verde**, con la línea del teardown. Correrlo **dos veces seguidas** y anotar el total real (no dar por buena la aritmética de este plan).

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(plantilla-c): el e2e cubre la columna unica, el lomo y que un club nuevo salga en C"
```

---

### Task 9: La spec vieja deja de mentir

`2026-08-08-plantillas-visuales-design.md` sigue describiendo a C como *"Tarjeta · app de consumo,
pensada para el pulgar"* con firma *"barra inferior con el recap vivo del turno"*, y su §6.1 entera
separa C de E por cosas que ya no existen. **Quien la lea sin saber de esta fase va a construir la
plantilla equivocada** — que es exactamente el problema que abrió esta fase.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md`

- [ ] **Step 1: Corregir la fila de C en la tabla §6**

```markdown
| **C · Básica** *(la default)* | Sobria: blanco, hairlines, el color justo | Outfit · Inter | primario **lomo** + **acento** — nunca masa | la banda vertical del color en el borde |
```

- [ ] **Step 2: Reemplazar la §6.1 entera**

Borrar la tabla vieja y poner un puntero, para que no haya dos contratos:

```markdown
### 6.1 Contrato de diferenciación C ↔ E

> **REESCRITO el 2026-08-16.** La versión que estaba acá separaba C de E por "varias cards apiladas"
> contra "un solo panel de vidrio" y por "CTA anclado abajo" contra "CTA dentro del flujo". El owner
> descartó las cards y el CTA anclado, así que **las dos mitades que definían a C dejaron de existir**
> y el contrato quedó sin sentido.
>
> **El contrato vigente está en `2026-08-16-plantilla-c-basica-design.md`, §4.** En una línea: la
> diferencia es **lomo + hairlines** contra **campo de color + vidrio**, o sea que C no usa el color
> como masa y E sí.
```

- [ ] **Step 3: Anotar el cambio de default donde se decide**

En la §5 de esa spec (tokens y white-label), agregar al final:

```markdown
**La plantilla por defecto es C desde el 2026-08-16** (antes era A). A los tenants que ya existían se
les escribió `'A'` explícito en la base antes de moverla, así que el cambio alcanza sólo a clubes
nuevos. Los fallbacks del contrato `--flow-*` **siguen siendo los valores de A**: protegen a una
cáscara que se olvidó de declarar un token, que es otro problema. Ver
`2026-08-16-plantilla-c-basica-design.md` §5.
```

- [ ] **Step 4: Verificar que no queden restos**

```bash
grep -n "Tarjeta\|para el pulgar\|cards apiladas" docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md
```
Expected: **cero resultados**.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md
git commit -m "docs(plantillas): la spec vieja deja de describir a C como la Tarjeta que ya no es"
```

---

## Puerta final de la rama

- [ ] `npm test` verde, con el total anotado.
- [ ] `npm run build` limpio, bundle anotado y explicado si se movió.
- [ ] `npx playwright test e2e` verde **dos veces seguidas**.
- [ ] **Revisión visual de C con las SEIS paletas** a 390 · 768 · 1280. Lo que se mira: que el lomo se vea en las seis (sobre todo el club casi blanco) y que la página no se lea como "sin terminar" — que es exactamente lo que el owner criticó de la C vieja, y no lo contesta ningún test.
- [ ] **C y E lado a lado con el mismo club.** La spec §4 pide que la diferencia se pueda nombrar sin mirar la tipografía. Si hay que decir "son parecidas pero con otra fuente", el contrato falló y hay que volver.
- [ ] `grep -rn "c-rail" src/` → cero resultados.
- [ ] La galería del panel muestra "C · Básica — Sobria, el color justo" y su miniatura sigue teniendo sentido (`shared/plantilla-thumb/`, silueta `.t-c`).
- [ ] Review de rama con un agente fresco.

## Lo que este plan NO hace

- **No toca A, B ni E**, salvo el comentario del contrato (Task 2) y el bloque de C en la hoja del pie (Task 6).
- **No recorta contenido de C.** "Básica" es sobriedad y ser la default, no mostrar menos — decisión explícita del owner.
- **No arregla la deuda del pie de A** ni la inversión figura/fondo del club casi blanco.
- **No rediseña la miniatura de C** en la galería. Si al terminar la silueta `.t-c` ya no representa a la plantilla, se anota como trabajo aparte.
