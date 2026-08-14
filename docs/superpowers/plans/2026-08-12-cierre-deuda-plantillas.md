# Cierre de deuda de plantillas · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar toda la deuda que dejaron las fases de plantillas A/B/E, y que la plantilla E llegue de verdad al dueño del club.

**Architecture:** ocho tareas independientes sobre una rama nueva. Las dos primeras arreglan la infraestructura de test que viene rompiendo las corridas de todas las fases anteriores (la suite que se ensucia sola y el race que produce el intermitente), así que todo lo que sigue se verifica sobre una base confiable. Las tres del medio pagan deuda visual y de accesibilidad que quedó fuera de la rama de E porque movía plantillas que esa rama prometió no mover — acá el movimiento es intencional y se mide. Las tres últimas son puertas y entrega: que ninguna cáscara futura pueda repetir los agujeros encontrados, y que E aparezca en el panel.

**Tech Stack:** Angular 21 standalone + signals + SSR · SCSS con el sistema de tres capas de tokens · Vitest (`@angular/build:unit-test`) · Playwright 1.61 · Spring Boot en el back (no se toca).

## Precondición · los merges

Este plan asume `main` con **todo lo anterior ya mergeado**. Antes de crear la rama:

1. Pushear `feat/plantilla-e-diurna` y abrir su PR.
2. Mergear en este orden: [front #11](https://github.com/412017-PILLADO/padelHubFront/pull/11) → [front #12](https://github.com/412017-PILLADO/padelHubFront/pull/12) → el PR de E → [back #5](https://github.com/412017-PILLADO/padelHubBack/pull/5).
3. **El back va último a propósito**: es el único que, adelantado, rompe una página en vivo.

La **Task 8 no se puede verificar sin back #5 mergeado** (es el que hace que el back acepte `plantilla: 'E'` al guardar). Si por lo que sea el back se demora, la Task 8 se corre igual pero su verificación de guardado queda pendiente — decirlo en el reporte, no fingir que pasó.

Rama: `feat/cierre-deuda-plantillas`, desde `main`.

## Global Constraints

- Comentarios, nombres de símbolos y mensajes de commit **en español**.
- **Sin dependencias nuevas.**
- **El sistema de tres capas de tokens** (spec §5.1) se respeta sin excepción: la capa 2 (cáscara) posee superficie/tinta/línea/tipografía y **nunca** declara `--court*`; la capa 3 (tenant, inline en `<html>` en runtime) posee `--court`, `--court-deep`, `--court-soft`, `--ink-on-accent` y **nunca** declara superficie ni tinta.
- **Contraste WCAG**: 4,5:1 para texto chico, 3:1 para texto grande/negrita y para componentes. El límite de "grande" es 24px = 18pt.
- **Las plantillas se mueven, y se mide cuánto.** A diferencia de las fases B y E, este plan SÍ cambia pixels de A, B y C — es su objetivo. Cada tarea que mueve algo reporta el número y a qué regla corresponde. Un movimiento no explicado es una regresión.
- Toda cáscara que gana una regla la gana en **su propio archivo**, no con un `::ng-deep` desde afuera ni con una excepción en la hoja global.

## Cómo correr las cosas (trampas del entorno, todas ya pagadas con horas)

- Unit: **`npm test` pelado y nada más**. `npm test -- --filter <archivo>` corre **cero tests y sale en verde** (el filtro es un regex sobre *nombres de test*, no rutas) y `npx vitest run <path>` reporta "no tests" porque se saltea el setup de Angular. Las dos son falsos verdes.
- Build: `npm run build`.
- E2E: **`npx playwright test e2e`, siempre con el path**. Pelado escanea `src/`, `.claude/` y el proyecto hermano BarberApp, carga dos `@playwright/test` y corrompe el runner.
- Playwright levanta su propio front en 4400 con `reuseExistingServer: false`. Matar cualquier `ng serve` propio antes:
  ```bash
  powershell -Command "Get-NetTCPConnection -LocalPort 4400 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force }"
  ```
- MySQL en 3308 y el back en :8095 (perfil `local`) tienen que estar arriba.
- **El harness visual miente si se lo deja.** Dos sets de capturas pueden salir del mismo bundle viejo y los dos leer 0. Antes de creerle a un 0 px: inyectar 1px de padding en una plantilla ajena, confirmar que aparece un diff grande, revertir. Está documentado en `.superpowers/sdd/progress-e.md`.
- Para un cambio de alcance chico, **diffear el CSS de componentes compilado** es más fuerte que los pixels y es inmune a esa trampa (lo usó el cierre de E: `.superpowers/sdd/task-e-cierre-report.md`).

## Fuera de alcance (y por qué)

- **La plantilla D** y el **rediseño de C** al nivel que describe el spec §6.1. Cada una es una fase visual con su propio plan y su propia puerta, igual que fueron B y E. Meterlas acá convertiría este plan en tres.
- La **Task 3 es la que las habilita**: mientras el anillo de foco viva dentro de cada cáscara, D va a ser el tercer autor copiando el mismo `color-mix` y volviendo a medir los mismos cinco clubes.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `e2e/global-teardown.ts` *(nuevo)* | Deja la base como la encontró al terminar la corrida | 1 |
| `e2e/helpers.ts` | Gana `TENANTS_E2E`, la lista de tenants que la suite toca | 1 |
| `playwright.config.ts` | Registra el teardown | 1 |
| `src/app/features/landing/booking/booking.store.ts` | Guarda de generación en `loadAvailability()` | 2 |
| `src/styles.scss` | `--anillo-foco` como token de capa 1 con default para superficie clara | 3 |
| `shells/b-nocturna/_tokens.scss`, `shells/e-diurna/_tokens.scss` | Cada una declara su `--anillo-foco` | 3 |
| `shells/b-nocturna/shell.scss`, `shells/e-diurna/shell.scss` | Pierden su `::ng-deep :focus-visible` | 3 |
| `shells/*/contraste.spec.ts` | Leen el token en vez de la regla `::ng-deep` | 3 |
| `club/landing-footer.scss` | A y C pierden el `opacity` que las deja bajo AA | 4 |
| `shells/b-nocturna/shell.scss`, `shells/e-diurna/shell.scss` | `line-height` propio del brandname | 5 |
| `club/pie-por-cascara.spec.ts` *(nuevo)* | Puerta: toda cáscara de `DIR_SHELL` tiene bloque de pie | 6 |
| `e2e/plantillas.spec.ts` | El orden de pintado de E, pineado por comportamiento | 7 |
| `admin/config/tabs/tab-club/tab-club.ts` | El selector deriva del registry | 8 |

---

### Task 1: La suite e2e se limpia sola

La suite crea reservas reales por la UI y **ninguna spec las limpia**. Corrida tras corrida se come la disponibilidad hasta que `panel.spec` y `sena.spec` fallan **por falta de datos y no por código** — un rojo que no dice nada. Ya bloqueó una tarea entera (E9) y obligó a limpiar la base a mano con SQL. Va primera porque todo lo que sigue se verifica con esta suite.

Cancelar alcanza y no es destructivo: el back libera el slot y la fila queda como rastro.

**Files:**
- Create: `e2e/global-teardown.ts`
- Modify: `e2e/helpers.ts` (agregar `TENANTS_E2E` al final del bloque de constantes, después de `OWNER` en la línea 5)
- Modify: `playwright.config.ts` (agregar `globalTeardown` junto a `testDir`, línea 13)

**Interfaces:**
- Consume: `API` y `futureDate()` de `e2e/helpers.ts`; `GET /api/v1/turnos?fecha=YYYY-MM-DD` (autenticado, tenant del JWT, devuelve `TurnoResponse[]` con `id` y `estado`) y `POST /api/v1/turnos/{id}/cancelar` del back.
- Produce: `TENANTS_E2E: readonly { slug: string; email: string; password: string }[]` en `helpers.ts`, que la Task 1 usa y cualquier spec futura puede reusar.

- [ ] **Step 1: Agregar la lista de tenants a `e2e/helpers.ts`**

Justo después de `export const OWNER = ...` (línea 5):

```ts
/**
 * Todos los tenants que la suite toca. `demo` es el de siempre; los otros cuatro los provisiona
 * `plantillas.spec.ts` por la API de plataforma si no existen. Vive acá y no en el teardown porque
 * es la respuesta a "¿en qué bases escribe esta suite?", y esa pregunta la va a tener cualquiera.
 */
export const TENANTS_E2E: readonly { slug: string; email: string; password: string }[] = [
  { slug: 'demo', email: OWNER.email, password: OWNER.password },
  { slug: 'acepadel', email: 'owner@acepadel.com', password: 'padel123' },
  { slug: 'costapadel', email: 'owner@costapadel.com', password: 'padel123' },
  { slug: 'urbanpadel', email: 'owner@urbanpadel.com', password: 'padel123' },
  { slug: 'solpadel', email: 'owner@solpadel.com', password: 'padel123' },
];
```

- [ ] **Step 2: Escribir el teardown**

Crear `e2e/global-teardown.ts`:

```ts
import { request as pwRequest } from '@playwright/test';
import { API, TENANTS_E2E, futureDate } from './helpers';

/**
 * Días hacia adelante que se barren. Las specs reservan dentro de la semana
 * (`elegirDiaYSlot` recorre los chips de día) y como mucho a `futureDate(5)`; 14 da margen sin
 * barrer medio calendario.
 */
const DIAS_VENTANA = 14;

/**
 * Deja la base como la encontró. La suite crea reservas reales por la UI y ninguna spec las
 * limpia, así que la disponibilidad se iba consumiendo hasta que `panel.spec` y `sena.spec`
 * fallaban por FALTA DE DATOS y no por código — un rojo que no dice nada, que costó horas de
 * diagnóstico y que ya obligó a limpiar la base a mano.
 *
 * Cancela, no borra: el back libera el slot igual y la fila queda como rastro de la corrida.
 *
 * NUNCA tira: un teardown que explota convierte una corrida verde en roja y esconde el resultado
 * real. Todo lo que falla acá se loguea y sigue.
 *
 * OJO en desarrollo: esto cancela TODA reserva futura de esos cinco tenants, incluidas las que
 * hayas creado a mano para un smoke test. Si estás probando algo a mano, corré la suite antes.
 */
async function limpiar(): Promise<void> {
  const ctx = await pwRequest.newContext();
  let cancelados = 0;

  for (const tenant of TENANTS_E2E) {
    const login = await ctx.post(`${API}/api/v1/auth/login`, {
      headers: { 'X-Tenant': tenant.slug, 'Content-Type': 'application/json' },
      data: { email: tenant.email, password: tenant.password },
    });
    // Un tenant que no existe todavía no es un error: la suite pudo correr filtrada y nunca
    // haberlo provisionado.
    if (!login.ok()) continue;
    const auth = { Authorization: `Bearer ${(await login.json()).token as string}` };

    for (let d = 0; d <= DIAS_VENTANA; d++) {
      const res = await ctx.get(`${API}/api/v1/turnos`, {
        headers: auth,
        params: { fecha: futureDate(d) },
      });
      if (!res.ok()) continue;
      const turnos = (await res.json()) as { id: number; estado: string }[];
      for (const turno of turnos) {
        if (turno.estado === 'CANCELADO') continue;
        const baja = await ctx.post(`${API}/api/v1/turnos/${turno.id}/cancelar`, { headers: auth });
        if (baja.ok()) cancelados++;
      }
    }
  }

  await ctx.dispose();
  console.log(`[teardown] ${cancelados} reserva(s) canceladas`);
}

export default async function globalTeardown(): Promise<void> {
  try {
    await limpiar();
  } catch (e) {
    console.warn('[teardown] no se pudo limpiar:', e);
  }
}
```

- [ ] **Step 3: Registrarlo en `playwright.config.ts`**

Debajo de `testDir: './e2e',` (línea 13):

```ts
  // La suite crea reservas reales y nadie las limpiaba: ver e2e/global-teardown.ts.
  globalTeardown: './e2e/global-teardown.ts',
```

- [ ] **Step 4: Verificar que efectivamente limpia**

Correr la suite dos veces seguidas:

```bash
npx playwright test e2e && npx playwright test e2e
```

Esperado: **las dos corridas en verde**, y al final de cada una una línea `[teardown] N reserva(s) canceladas` con N > 0. Antes de este cambio la segunda corrida acumulaba sobre la primera; el punto de correr dos veces es que la segunda demuestra que la primera dejó lugar.

- [ ] **Step 5: Verificar que un teardown roto no ensucia el resultado**

Romperlo a propósito, con un `throw` de verdad como primera línea de `limpiar()`:

```ts
  throw new Error('ROTURA DELIBERADA para probar que el teardown no ensucia el resultado');
```

(Cuidado con roturas que parecen roturas y no lo son: cambiar `DIAS_VENTANA` por un no-número **no sirve** — `0 <= 'x'` es `false`, el loop no itera y la función termina normalmente sin llegar nunca al `catch`. Prueba un no-op, no el manejo de error.)

Correr `npx playwright test e2e`.
Esperado: la suite igual reporta **21 passed** y aparece el `[teardown] no se pudo limpiar:`. Revertir el cambio.

- [ ] **Step 6: Commit**

```bash
git add e2e/global-teardown.ts e2e/helpers.ts playwright.config.ts
git commit -m "test(e2e): la suite cancela sus propias reservas al terminar"
```

---

### Task 2: El race de `loadAvailability()`

`loadAvailability()` dispara una suscripción sin cancelar la anterior. Si el visitante cambia de día rápido, la respuesta vieja llega después de la nueva y **repinta la grilla con los turnos del día que ya abandonó**. En los tests se manifiesta como el intermitente de `plantillas.spec` / `reserva.spec` fallando en el click de `.confirm` con "element was detached from the DOM"; en producción es un visitante mirando horarios que no son del día que eligió.

Va segunda porque es el intermitente que mete ruido en la verificación de todas las tareas que siguen.

**Files:**
- Modify: `src/app/features/landing/booking/booking.store.ts:389-410` (el método `loadAvailability`)
- Test: `src/app/features/landing/booking/booking.store.spec.ts`

**Interfaces:**
- Produce: nada público. El campo `pedidoSlots` es privado y ningún consumidor cambia.

- [ ] **Step 1: Escribir el test que falla**

El `bookingFalso` que ya está arriba del archivo devuelve `of([])` fijo y no sirve para esto: hace falta poder controlar **cuándo** responde cada pedido. Va en un `describe` propio, al final de `booking.store.spec.ts`:

```ts
describe('BookingStore · disponibilidad fuera de orden', () => {
  let store: BookingStore;
  let enVuelo: Subject<Slot[]>[];

  beforeEach(() => {
    enVuelo = [];
    // A diferencia del `bookingFalso` de arriba (que responde ya, con `of([])`), este entrega un
    // Subject por llamada y lo guarda: así el test decide el ORDEN en que contestan.
    const bookingDemorado = {
      config: () => of(null as never),
      disponibilidad: () => {
        const s = new Subject<Slot[]>();
        enVuelo.push(s);
        return s.asObservable();
      },
      crearReserva: () => of(null as never),
      crearLinkSena: () => of({ initPoint: '' }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingService, useValue: bookingDemorado },
        MessageService,
        ClubStore,
        BookingStore,
      ],
    });
    store = TestBed.inject(BookingStore);
  });

  it('descarta la respuesta que llega tarde y deja la del día elegido', () => {
    store.selectDay(new Date(2026, 0, 10));
    store.selectDay(new Date(2026, 0, 11));
    expect(enVuelo).toHaveLength(2);

    // El día NUEVO contesta primero y el VIEJO después: es el orden que rompía la grilla.
    enVuelo[1].next([{ hora: '11:00', disponible: true, canchasLibres: [] } as unknown as Slot]);
    enVuelo[0].next([{ hora: '09:00', disponible: true, canchasLibres: [] } as unknown as Slot]);

    expect(store.slots().map((s) => s.hora)).toEqual(['11:00']);
  });

  it('el error de un pedido viejo no apaga el spinner del nuevo', () => {
    store.selectDay(new Date(2026, 0, 10));
    store.selectDay(new Date(2026, 0, 11));

    enVuelo[0].error(new Error('el pedido viejo falló tarde'));

    expect(store.loadingSlots()).toBe(true);
    expect(store.slotsLoaded()).toBe(false);
  });
});
```

Agregar `Subject` al import de `rxjs` y `Slot` al de tipos, tomando la ruta de `Slot` de la que ya usa `booking.store.ts`.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test`
Esperado: **FAIL** en ese test, con `['09:00']` recibido en vez de `['11:00']` — la respuesta vieja pisó a la nueva.

- [ ] **Step 3: La guarda de generación**

En `booking.store.ts`, agregar el campo junto a los otros privados de la clase:

```ts
  /**
   * Generación del pedido de disponibilidad en curso. Cada llamada a `loadAvailability()` se lleva
   * un número; cuando vuelve la respuesta, si ya no es la última, se descarta. Sin esto, cambiar de
   * día rápido dejaba que la respuesta VIEJA llegara después y repintara la grilla con los turnos
   * del día que el visitante ya abandonó — en los e2e salía como un "element detached from the DOM"
   * al clickear confirmar.
   */
  private pedidoSlots = 0;
```

Y reescribir `loadAvailability` (línea 389):

```ts
  private loadAvailability(day: Date): void {
    const pedido = ++this.pedidoSlots;
    this.loadingSlots.set(true);
    this.slotsLoaded.set(false);
    this.slots.set([]);
    this.booking.disponibilidad(this.apiFecha(day), this.duracion()).subscribe({
      next: (slots) => {
        if (pedido !== this.pedidoSlots) return;
        this.slots.set(slots);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
      },
      error: () => {
        if (pedido !== this.pedidoSlots) return;
        this.slots.set([]);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar los turnos. Probá de nuevo.',
        });
      },
    });
  }
```

La guarda va en los **dos** brazos: un error viejo que llega tarde apagaba el spinner del pedido nuevo y encima mostraba un toast por un día que ya no está en pantalla.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test`
Esperado: **PASS**, y el total de unit sube en 1 respecto de la base.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/booking/booking.store.ts src/app/features/landing/booking/booking.store.spec.ts
git commit -m "fix(reserva): la disponibilidad que llega tarde ya no pisa el dia elegido"
```

- [ ] **Step 6: Confirmar en el e2e**

Run: `npx playwright test e2e`
Esperado: **21 passed**. Este intermitente no se puede "probar ausente" en una corrida, así que no se afirma que está muerto — se afirma que la suite pasa y que la causa quedó eliminada por construcción.

---

### Task 2b: La otra mitad del race — `initDefaultDay()`

*(Agregada después de la review de la Task 2, que la encontró y la midió.)*

`initDefaultDay()` (`booking.store.ts:332-347`) tiene **la misma carrera y ninguna guarda**: su `forkJoin` escribe `selectedDay`, `slots` y `slotsLoaded` sin chequear nada, y no lee ni incrementa `pedidoSlots`, así que los dos caminos son **mutuamente invisibles en los dos órdenes**. Encima nunca toca `loadingSlots`, así que una sonda que llega tarde repinta `.times` **sin spinner que tape el cambio** — el repintado silencioso.

Y es la mitad **grande** del intermitente. Los `.dur-chips` recién se pintan cuando resuelve `club.config()`, o sea **después** de que `initDefaultDay()` ya salió: la secuencia real es config → chips → Playwright clickea duración → clickea día, corriendo contra 3 GET de disponibilidad en paralelo. Eso es una ventana de velocidad-Playwright contra un round trip real; la que arregló la Task 2 necesitaba dos cambios de día a velocidad humana.

**No hace falta ninguna decisión de producto.** El store ya resolvió esta misma pregunta para la duración: `duracionElegida` existe para que "el default de la config no se le imponga tarde" al que ya eligió. `initDefaultDay` calcula un **default**, y un default que pisa una elección explícita es un bug bajo la convención que el propio archivo declara.

**Files:**
- Modify: `src/app/features/landing/booking/booking.store.ts` (`initDefaultDay`, y `selectDay` en la línea 359)
- Test: `src/app/features/landing/booking/booking.store.spec.ts`

- [ ] **Step 1: El test que falla**

En el `describe` de "disponibilidad fuera de orden" que agregó la Task 2, un test donde el visitante elige día **antes** de que resuelva el `forkJoin` inicial, y el `forkJoin` no tiene que pisarle ni el día ni los slots.

Ojo con el harness: el `forkJoin` sale del `effect()` del constructor, que espera que `ClubStore.estadoCarga()` llegue a `'ok'`, así que el doble de config necesita un payload real y no `of(null)`. Leer cómo lo arma el resto del archivo.

- [ ] **Step 2: Correr y ver el rojo**

Run: `npm test`
Esperado: **FAIL**, con el día y los slots pisados por la sonda inicial.

- [ ] **Step 3: La guarda**

Un campo privado, simétrico a `duracionElegida`:

```ts
  /**
   * Si el visitante ya eligió día a mano. `initDefaultDay()` calcula un DEFAULT, y un default que
   * llega tarde no tiene por qué pisar una elección explícita — misma regla que `duracionElegida`
   * aplica para la duración.
   *
   * Es un campo suelto y NO una lectura de `selectedDay()`: el `forkJoin` corre dentro del
   * `effect()` del constructor, así que leer un signal ahí lo convierte en dependencia del effect y
   * cada `selectDay()` volvería a dispararlo entero. Es la misma trampa que documenta
   * `duracionElegida`.
   */
  private diaElegido = false;
```

Se pone en `true` en `selectDay()`, y el subscribe del `forkJoin` arranca con `if (this.diaElegido) return;`.

- [ ] **Step 4: Verde**

Run: `npm test`
Esperado: **PASS**.

- [ ] **Step 5: Cerrar el Minor de la Task 2**

La review dejó anotado que el test del brazo de `error` pinea `loadingSlots`/`slotsLoaded` pero **no el toast suprimido**, aunque el comentario del código nombra al toast como una de las razones de la guarda. Agregar un `expect` sobre un spy de `MessageService.add`.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/booking/
git commit -m "fix(reserva): el dia por default no pisa al que el visitante ya eligio"
```

- [ ] **Step 7: E2E**

Run: `npx playwright test e2e`
Esperado: **21 passed**. Igual que en la Task 2: no se afirma que el intermitente murió — se afirma que la suite pasa y que las dos causas conocidas quedaron eliminadas por construcción.

---

### Task 3: El anillo de foco sale a la capa de plataforma

El `:focus-visible` global usa `outline: 2px solid var(--court)` — **el color del club crudo**. Medido: naranja del tenant demo **2,07:1**, amarillo **1,32:1**, contra el mínimo de 3:1 para componentes. Un usuario de teclado no ve dónde está parado.

B y E cada una se lo resolvió a mano dentro de su cáscara, con un `::ng-deep` y su propio `color-mix`. A, C y el **panel de admin entero** (que también usa la regla global sobre superficie clara) no tienen nada. Ésta es la tarea que la review final marcó como *lo más importante antes de la plantilla D*: si no, D es el tercer autor copiando la misma fórmula.

La forma: `--anillo-foco` como token de **capa 2**, con un default de capa 1 pensado para superficie clara. Cada cáscara lo pisa desde su `_tokens.scss` si su superficie lo pide. Se van los dos `::ng-deep`.

**Files:**
- Modify: `src/styles.scss` (bloque `:root`, y la regla `:focus-visible` de la línea 145)
- Modify: `src/app/features/landing/shells/b-nocturna/_tokens.scss`, `.../e-diurna/_tokens.scss`
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss:147-150`, `.../e-diurna/shell.scss:99-101` (borrar el bloque `::ng-deep`)
- Test: `src/app/features/landing/shells/b-nocturna/contraste.spec.ts`, `.../e-diurna/contraste.spec.ts`

**Interfaces:**
- Produce: `--anillo-foco`, token de capa 2. Toda cáscara futura lo declara en su `_tokens.scss` si su superficie no es clara; si no lo declara, hereda el default de `:root`.

- [ ] **Step 1: Medir el estado actual antes de tocar nada**

Levantar el front y medir el contraste del `outline` contra la superficie sobre la que cae, para las plantillas A y C y para el panel, con los colores de club que ya usó la Task 8 de la fase E (están en `.superpowers/sdd/task-e8-report.md`: teal de plataforma, naranja demo, amarillo, casi blanco, casi negro, y el de un club saturado). Anotar los seis números **antes**. Sin esta tabla no hay forma de decir si el cambio mejoró.

- [ ] **Step 2: El token y su default en `src/styles.scss`**

En `:root`, después del bloque de `--ink-on-accent` y antes de `--clay`:

```scss
  /* Anillo del foco de teclado. NO es `--court` pelado: el color del club crudo da 2,07:1 con el
     naranja del tenant demo y 1,32:1 con un amarillo, contra el mínimo de 3:1 que WCAG pide para
     componentes — el usuario de teclado no veía dónde estaba parado.
     El default mezcla hacia la tinta del sistema, que es lo correcto sobre superficie CLARA: la
     landing A y C, y todo el panel. Una cáscara oscura no puede usar esta fórmula (oscurecer sobre
     oscuro desaparece) y la pisa desde su `_tokens.scss` — es un token de capa 2. */
  --anillo-foco: color-mix(in srgb, var(--court) 55%, var(--ink));
```

Y la regla de la línea 145 pasa a consumirlo:

```scss
/* — Foco accesible — */
:focus-visible {
  outline: 2px solid var(--anillo-foco);
  outline-offset: 3px;
  border-radius: 3px;
}
```

- [ ] **Step 3: Cada cáscara declara el suyo**

En `shells/b-nocturna/_tokens.scss`, junto al resto de sus tokens de capa 2:

```scss
  /* Sobre el telón nocturno hay que ACLARAR, no oscurecer: el default de plataforma mezcla hacia
     la tinta y acá la tinta es clara, así que la fórmula se invierte. Es el mismo 60% que tenía el
     `::ng-deep :focus-visible` que este token reemplaza. */
  --anillo-foco: color-mix(in srgb, var(--court) 60%, #fff);
```

En `shells/e-diurna/_tokens.scss`:

```scss
  /* El anillo de E cae sobre el campo de color a plena saturación, no sobre la superficie clara del
     default, así que mezcla hacia negro y no hacia la tinta del sistema. Mismo 55% que tenía el
     `::ng-deep :focus-visible` que este token reemplaza. */
  --anillo-foco: color-mix(in srgb, var(--court) 55%, #000);
```

- [ ] **Step 4: Borrar los dos `::ng-deep`**

En `b-nocturna/shell.scss`, eliminar el bloque de las líneas 147-150 (`:host ::ng-deep :focus-visible { outline: ...; outline-offset: 2px; }`).

**Atención — `outline-offset`:** B declaraba `2px` y el global es `3px`. Al borrar el bloque, B pasa a 3px. Si el bloque de comentario de arriba (líneas 125-146) explica por qué eran 2px, conservar ese valor **como token** en `_tokens.scss` en vez de perderlo; si no lo explica, dejar que herede los 3px y decirlo en el reporte. Leer ese comentario antes de decidir: documenta una interacción con el `:focus-visible` propio de PrimeNG en el datepicker y **hay que releerla entera** — parte de lo que dice puede seguir aplicando al token.

En `e-diurna/shell.scss`, eliminar las líneas 99-101.

- [ ] **Step 5: Los specs de contraste leen el token**

Los dos `contraste.spec.ts` extraen el `outline` con un regex anclado a `:host ::ng-deep :focus-visible` sobre `shell.scss` (B: líneas 110-111; E: líneas 146-155). Ese selector ya no existe: hay que leer el token de `_tokens.scss`.

En B, reemplazar el regex de la línea 110 por:

```ts
/**
 * El anillo sale de `--anillo-foco`, token de capa 2, y ya NO de un `:host ::ng-deep :focus-visible`
 * en `shell.scss`: el `:focus-visible` global de `styles.scss` lo consume, así que la cáscara
 * declara el color y no vuelve a escribir la regla. Lo que este spec exige no cambió — cambió de
 * dónde se lee.
 *
 * El `:` pegado en `--anillo-foco\s*:` es lo que evita matchear un token que apenas lo prefije.
 */
const ANILLO = ejemploDe(
  /--anillo-foco\s*:\s*([^;]+);/.exec(TOKENS_SHELL)?.[1] ?? null,
  '_tokens.scss · el valor de `--anillo-foco`',
);
```

Ajustar `ejemploDe` / `TOKENS_SHELL` a los nombres reales del archivo: hoy lee `HOJA_SHELL` (el `shell.scss`), así que hace falta además una constante que lea el parcial de tokens con el mismo helper que ya usa para leer hojas. **La aserción de contraste que consume ese valor no se toca.**

En E, el mismo cambio sobre su bloque equivalente.

- [ ] **Step 6: Correr los tests**

Run: `npm test`
Esperado: **PASS**, mismo total que después de la Task 2b. Si algún spec de contraste pasa sin haber sido tocado, sospechar: puede estar matcheando vacío.

Verificarlo rompiéndolo a propósito — pero **elegir bien la rotura**. Bajar el 60% de B a 5% **no sirve**: sobre una cáscara oscura, menos `--court` y más blanco da MÁS contraste, así que el spec se queda verde con razón y el falso negativo es de la prueba, no del spec. La rotura tiene que mover el valor hacia donde el spec duele: para B, hacia el color crudo del club (subir el porcentaje); para E, al revés. Probar hasta ver rojo de verdad.

- [ ] **Step 7: Medir de nuevo, y mirar**

Repetir la tabla del Step 1. Los seis clubes tienen que dar **≥ 3:1 en A, C y el panel**, y B y E no tienen que haber empeorado. Si algún club no llega a 3:1 con el 55%, subir el porcentaje hasta que llegue y reportar el techo medido — igual que hizo el cierre de E con su 30%.

Además, mirarlo con los propios ojos: tabular por la landing de A y de C y por el panel, y confirmar que el anillo se ve.

- [ ] **Step 8: Medir cuánto se movieron A y C**

Este cambio **mueve A y C a propósito** (es el punto). Medirlo y reportarlo: el anillo sólo se pinta con foco, así que en una captura sin foco el diff tiene que ser **0 px**. Si no es 0, el token se filtró a algo que no era el anillo — investigar antes de seguir.

Usar el harness con su sensor, o el diff del CSS compilado. Decir cuál se usó.

- [ ] **Step 9: Commit**

```bash
git add src/styles.scss src/app/features/landing/shells/
git commit -m "fix(a11y): el anillo de foco pasa a token de plataforma y deja de ser el color crudo del club"
```

---

### Task 4: Los links del pie de A y C salen de abajo de AA

`.arrep-link` base trae `opacity: 0.85` y `.politica-link` la suya. Eso es exactamente lo que deja al `.arrep-link` de **C en 4,13:1**, bajo el mínimo de 4,5:1 para texto chico. E ya lo resolvió en su bloque con `opacity: 1` (ver `landing-footer.scss:94-97`, que documenta el problema y anota que C queda pendiente). Ésta es esa pendiente.

**Files:**
- Modify: `src/app/features/landing/club/landing-footer.scss` (bloques `:host(.c-foot)` líneas 46-58 y `:host(.pb-foot)` líneas 30-36)
- Test: `src/app/features/landing/club/landing-footer.spec.ts`

- [ ] **Step 1: Medir A y C antes**

Medir el contraste computado de `.arrep-link` y `.politica-link` en A y en C, en los seis clubes de la tabla de la Task 3. Anotar. El valor conocido de partida es C en 4,13:1; A usa `--ink-on-accent` al 90% sobre el acento y hay que medirlo, no asumirlo.

- [ ] **Step 2: Sacar la opacidad en C**

En el bloque `:host(.c-foot)` de `landing-footer.scss`, agregar a las reglas que ya existen para esos dos botones:

```scss
/* `opacity: 1` y no un color más claro: el `.arrep-link` base trae `opacity: 0.85` y eso solo ya
   dejaba a C en 4,13:1, bajo el 4,5:1 de texto chico. Mismo arreglo que hizo E. */
:host(.c-foot) .arrep-link { color: var(--ink-dim); opacity: 1; }
:host(.c-foot) .politica-link { color: var(--ink-dim); opacity: 1; }
```

(Reemplazar las declaraciones existentes de las líneas 48 y 50, no duplicarlas.)

- [ ] **Step 3: Decidir sobre A con la medición en la mano**

Si A da **≥ 4,5:1**, no tocarla — y decirlo en el reporte con el número. Si no llega, subir el `color-mix` del 90% hasta que llegue, reportando el porcentaje y que es un mínimo medido, no elegido.

- [ ] **Step 4: Pinear el resultado**

Agregar a `landing-footer.spec.ts` una aserción de que **ni `.arrep-link` ni `.politica-link` de C llevan `opacity` menor a 1**, siguiendo el estilo del archivo. Sin esto, el `opacity: .85` vuelve la próxima vez que alguien toque el bloque base.

- [ ] **Step 5: Correr y medir de nuevo**

Run: `npm test`
Esperado: **PASS**, total +1 respecto de la Task 3.

Repetir la medición del Step 1. C tiene que estar en ≥ 4,5:1 en los seis clubes.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/club/
git commit -m "fix(pie): los botones del pie de C dejan de estar bajo AA por opacidad"
```

---

### Task 5: Los acentos en mayúscula dejan de cortarse

Un club llamado `Sol Pádel` renderiza **`SOL PADEL`** en B y en E. La causa es la combinación de tres cosas: `.display` trae `line-height: 0.92` con `text-transform: uppercase`, y `.b-brandname` / `.e-brandname` llevan `overflow: hidden` (que está ahí para el `text-overflow: ellipsis`). Con una condensada como Anton, la tilde de la mayúscula queda fuera de la caja de línea y se recorta.

**En un producto en español esto no es cosmético**: es la marca del cliente saliendo mal en el primer paint, y la mayoría de los nombres de club llevan tilde.

El `0.92` existe para apretar el interlineado de títulos de varias líneas. Un brandname es **una sola línea con ellipsis** — ahí no aporta nada y sólo recorta. `.c-brandname` ya lleva `line-height: 1.15` propio y por eso C nunca tuvo el problema: el arreglo es hacer lo mismo en B y E, no tocar el token global.

**Files:**
- Modify: `src/app/features/landing/shells/b-nocturna/shell.scss:176` (`.b-brandname`)
- Modify: `src/app/features/landing/shells/e-diurna/shell.scss:158-159` (`.e-brandname`)
- Test: verificación visual (no hay unit razonable para un recorte de glifo)

- [ ] **Step 1: Reproducirlo**

Levantar el front y mirar los brandnames de B y de E con un nombre acentuado. El tenant `solpadel` que provisiona `plantillas.spec.ts` se llama **Sol Pádel** y sirve tal cual para E; para B, el tenant `costapadel` es **Costa Pádel**. Confirmar el recorte con los propios ojos **antes** de arreglar. Si no se reproduce, decirlo y parar.

Revisar de paso los otros consumidores de `.display` con nombre de club: `.name` de A (`a-afiche/shell.scss:98`) y `.watermark`. Si alguno también recorta, entra en esta tarea; si no, decirlo.

- [ ] **Step 2: Darle interlineado propio al brandname de B**

En `b-nocturna/shell.scss`, línea 176:

```scss
/* `line-height` propio y no el 0.92 que hereda de `.display`: ese valor está para apretar títulos de
   VARIAS líneas, y acá es una sola con ellipsis. Con `overflow: hidden` (que el ellipsis necesita) y
   una condensada como Anton, 0.92 dejaba la tilde de la mayúscula fuera de la caja: "Costa Pádel"
   salía "COSTA PADEL". Es el mismo 1.15 que `.c-brandname` ya tenía, y por eso C nunca lo sufrió. */
.b-brandname { min-width: 0; font-size: 1.12rem; line-height: 1.15; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 3: Lo mismo en E**

En `e-diurna/shell.scss`, línea 158:

```scss
/* Ver el comentario de `.b-brandname`: el 0.92 heredado de `.display` recortaba la tilde de las
   mayúsculas y "Sol Pádel" salía "SOL PADEL". */
.e-brandname { min-width: 0; font-size: 1.5rem; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 4: Verificar el arreglo y el costo**

Mirar de nuevo B y E con nombre acentuado, en **360 y 1280**. La tilde tiene que verse entera, y el ellipsis tiene que seguir funcionando con un nombre largo.

Medir el movimiento: subir el interlineado **cambia la altura de la caja del brandname**, así que va a haber diff. Reportar cuánto y confirmar que está confinado a la barra de marca. Si el diff se derrama al resto del layout, el brandname estaba aportando altura a algo — investigar antes de seguir.

- [ ] **Step 5: Confirmar que A y C no se movieron**

A y C no se tocan en esta tarea. Confirmarlo con el harness (con sensor) o con el diff del CSS compilado: **0 px**.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/shells/
git commit -m "fix(plantillas): la tilde de las mayusculas del nombre del club deja de recortarse"
```

---

### Task 6: Las dos puertas que faltan

Son dos invariantes que hoy se sostienen solas y que nada obliga: el bloque de pie por cáscara, y el default del anillo de foco.

#### 6·A · El default de `--anillo-foco` no tiene quien lo cuide

*(Agregado después de la Task 3, que lo dejó anotado como su única preocupación.)*

La Task 3 dejó tres valores de `--anillo-foco`: el de B y el de E, **pineados** por sus `contraste.spec.ts`, y el **default de `:root`** — que es el que protege a A, a C y **al panel entero** — sin nada que lo mida. El 50% es un techo medido (51,7% era el límite del club casi blanco): alguien que lo redondee a 55% en un cleanup deja a ese club en 2,72:1 y la suite entera sigue verde.

Es exactamente la clase de agujero que esta rama está cerrando en otro lado, así que se cierra acá también: un spec de contraste **de plataforma** que lea el default de `styles.scss` y lo mida contra `--paper` con las mismas paletas de clubes que usó la Task 3. Seguir el estilo de los `contraste.spec.ts` que ya existen y probarlo en rojo subiendo el porcentaje.

#### 6·B · Una puerta que exige bloque de pie a toda cáscara

La Task 4 de la fase E convirtió el pie en una **obligación por cáscara**: sacó el tratamiento compartido y dejó que cada una declare el suyo en un bloque `:host(.X-foot)`. El commit inmediatamente siguiente creó la cáscara E **sin cumplirla**, y el resultado fue que sus dos botones salieron negro puro durante toda la fase, con la suite entera en verde.

Ese es exactamente el modo de falla que mató la puerta del contrato `--flow-*` (`booking/contrato-flow.spec.ts`). Esta tarea le da la misma puerta al pie.

La clase del pie **no hay que hardcodearla**: cada cáscara la escribe en su propio `shell.html` (`<app-landing-footer class="e-foot" …>`), así que el spec la deriva de ahí. Alta de cáscara = nada que sincronizar.

**Files:**
- Create: `src/app/features/landing/club/pie-por-cascara.spec.ts`
- Test: es el test

**Interfaces:**
- Consume: `DIR_SHELL` de `src/app/core/landing/plantillas.ts` (el mapa código → carpeta), leído igual que lo hace `contrato-flow.spec.ts`.

- [ ] **Step 1: Leer la puerta que ya existe**

Leer `src/app/features/landing/booking/contrato-flow.spec.ts` entero antes de escribir nada. Es el patrón a seguir: deriva la lista de cáscaras de `DIR_SHELL`, lee las hojas del disco, sigue los `@include` hacia los parciales y extrae cuerpos de bloque con conteo de llaves balanceado. Reusar su enfoque y su estilo, no inventar uno nuevo.

- [ ] **Step 2: Escribir la puerta**

Crear `pie-por-cascara.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIR_SHELL } from '../../../core/landing/plantillas';

/**
 * La Task 4 de la fase E convirtió el pie en una OBLIGACIÓN POR CÁSCARA: sacó el tratamiento
 * compartido y dejó que cada una declare el suyo en un bloque `:host(.X-foot)`. El commit
 * inmediatamente siguiente creó la cáscara E sin cumplirla, y sus dos botones salieron NEGRO PURO
 * durante toda la fase con la suite entera en verde. `.arrep-link` y `.politica-link` son `<button>`
 * y el negro es el default del navegador: la ausencia de la regla no rompe nada, sólo se ve mal.
 *
 * Esta es esa obligación hecha puerta, con el mismo patrón que `booking/contrato-flow.spec.ts`.
 *
 * La clase del pie NO está hardcodeada acá: cada cáscara la escribe en su propio `shell.html`, así
 * que se deriva de ahí. Alta de cáscara = nada que sincronizar en este archivo.
 *
 * Las rutas van desde la raíz del proyecto y no relativas al spec: el builder bundlea los specs a un
 * temporal, así que `import.meta.url` apuntaría al bundle y no al árbol de fuentes.
 */
const leer = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

const HOJA_PIE = leer('src/app/features/landing/club/landing-footer.scss');

/** La clase que la cáscara le pone al `<app-landing-footer>` de su plantilla. */
function claseDelPie(dir: string): string {
  const html = leer(`src/app/features/landing/shells/${dir}/shell.html`);
  const m = /<app-landing-footer[^>]*\sclass="([^"]+)"/.exec(html);
  if (!m) throw new Error(`${dir}/shell.html no monta <app-landing-footer> con class`);
  return m[1].trim().split(/\s+/)[0];
}

/** Las declaraciones de `:host(.clase) <selector>` que la hoja del pie tiene para esa cáscara. */
function declaraColor(clase: string, selector: string): boolean {
  const re = new RegExp(
    `:host\\(\\.${clase}\\)\\s+\\${selector}\\s*(?::[a-z-]+)?\\s*\\{[^}]*\\bcolor\\s*:`,
  );
  return re.test(HOJA_PIE);
}

describe('El pie tiene un bloque por cáscara', () => {
  for (const [codigo, dir] of Object.entries(DIR_SHELL)) {
    // Los dos son <button>: sin `color` propio el navegador los pinta de negro puro sobre
    // cualquier superficie. Es el defecto concreto que esta puerta existe para matar, así que se
    // exige el `color` y no la mera presencia de un bloque.
    for (const selector of ['.arrep-link', '.politica-link']) {
      it(`la plantilla ${codigo} (${dir}) le declara color a ${selector}`, () => {
        const clase = claseDelPie(dir);
        expect(
          declaraColor(clase, selector),
          `landing-footer.scss no tiene \`:host(.${clase}) ${selector} { color: … }\`. ` +
            `La cáscara ${dir} monta el pie con la clase "${clase}" pero no lo viste: ` +
            `${selector} es un <button> y va a salir NEGRO PURO. Agregá el bloque.`,
        ).toBe(true);
      });
    }
  }
});
```

El mensaje de falla nombra la cáscara, la clase, el selector y qué escribir: quien agregue la cáscara D y vea rojo no tiene que leer este spec para saber qué hacer.

- [ ] **Step 3: Probarla en rojo — dos veces**

Una puerta que no se vio fallar no es una puerta.

1. Borrar la línea `:host(.e-foot) .arrep-link { … }` de `landing-footer.scss`. Correr `npm test`. Esperado: **FAIL** nombrando `e-diurna` y `.arrep-link`. Revertir.
2. Borrar la clase `e-foot` del `<app-landing-footer>` de `e-diurna/shell.html`. Correr `npm test`. Esperado: **FAIL** nombrando `e-diurna`. Revertir.

La segunda importa: sin ella la puerta podría estar derivando una clase vacía y matcheando cualquier cosa.

- [ ] **Step 4: Correr en verde**

Run: `npm test`
Esperado: **PASS**, y la puerta cubre las cuatro cáscaras. Total +1 respecto de la Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/club/pie-por-cascara.spec.ts
git commit -m "test(pie): toda cascara tiene que declarar su bloque de pie o la suite se pone roja"
```

---

### Task 7: El orden de pintado de E queda pineado

La firma de E es el panel de vidrio **a caballo del borde del campo**. El e2e ya pinea el solape vertical (`campo.bottom − vidrio.top >= 40`), pero no que el vidrio quede **encima**: `e-diurna/shell.scss:170` documenta que el panel tapa al campo puramente por orden de documento, sin `position` ni `z-index`. Un `position: relative` en `.e-campo` metería el vidrio abajo del color — la firma desaparecería y **todos los tests seguirían verdes**, incluido el del solape, que mide geometría y no capas.

La review final lo marcó como la mitad no guardada de la firma.

**Files:**
- Modify: `e2e/plantillas.spec.ts` (el bloque `if (tpl === 'E')` que agregó la Task 9 de la fase E)

- [ ] **Step 1: Escribir la aserción**

Dentro del bloque de E que ya existe, junto a la aserción del solape, agregar una que pregunte **quién está pintado arriba** en el punto medio de la zona de solape:

```ts
  // El vidrio tapa al campo por ORDEN DE DOCUMENTO, sin position ni z-index (ver shell.scss). Un
  // `position: relative` en `.e-campo` lo mandaría abajo del color y el solape de arriba seguiría
  // midiendo lo mismo: la geometría no ve las capas. Esto sí.
  const arriba = await page.evaluate(() => {
    const campo = document.querySelector('.e-campo')!.getBoundingClientRect();
    const vidrio = document.querySelector('.booking-flow')!.getBoundingClientRect();
    const y = (vidrio.top + campo.bottom) / 2;      // el medio de la franja solapada
    const el = document.elementFromPoint(vidrio.left + vidrio.width / 2, y);
    return el?.closest('.booking-flow') !== null;
  });
  expect(arriba, 'el vidrio tiene que quedar por ENCIMA del campo en la zona de solape').toBe(true);
```

Verificar los selectores contra el markup real de `e-diurna/shell.html` antes de darlo por bueno; la Task 9 de la fase E usó `.e-campo` y `.booking-flow` y ésos son los que hay que reusar.

- [ ] **Step 2: Probarla en rojo**

Agregar `position: relative;` a `.e-campo` en `e-diurna/shell.scss`. Correr:

```bash
npx playwright test e2e/plantillas.spec.ts
```

Esperado: **FAIL** en la aserción nueva, y —esto es el punto— **la del solape sigue pasando**. Confirmar las dos cosas: es lo que demuestra que la aserción nueva cubre algo que la vieja no. Revertir.

- [ ] **Step 3: Verde**

Run: `npx playwright test e2e`
Esperado: **21 passed** (la aserción se suma a un test que ya existe, no crea uno nuevo).

- [ ] **Step 4: Commit**

```bash
git add e2e/plantillas.spec.ts
git commit -m "test(plantilla-e): el vidrio tiene que quedar arriba del campo, no solo solapado"
```

---

### Task 8: El selector del panel deriva del registry

`tab-club.ts:24` tiene la lista de plantillas escrita a mano, con **A, B y C nada más**, y con descripciones viejas: B figura como *"Hero centrado — marca grande centrada, más comercial"* cuando hoy es la nocturna. **Ningún dueño de club puede elegir E**, que está construida, pasa el e2e y no llega a nadie.

Es la 4ª copia a mano de una constante que la fase E dedujo dos veces (`DIR_SHELL` → `CODIGOS_CON_SHELL`). El registry ya tiene `nombre` y `descripcion` de las cinco.

**Ofrecer sólo las que tienen cáscara**, o sea `CODIGOS_CON_SHELL` y no `CODIGOS_PLANTILLA`: D está en el catálogo porque el back la acepta, pero no tiene cáscara y `shellDePlantilla()` la manda a la A. Un dueño que la eligiera vería la plantilla A y pensaría que se rompió algo. Cuando D exista, aparece sola.

**Requiere back #5 mergeado** para poder verificar el guardado de `plantilla: 'E'`.

**Files:**
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.ts:24-28`
- Test: el spec de `tab-club` si existe; si no, verificación manual documentada

**Interfaces:**
- Consume: `PLANTILLAS` y `CODIGOS_CON_SHELL` de `src/app/core/landing/plantillas.ts`.

- [ ] **Step 1: Derivar la lista**

Reemplazar el array hardcodeado (líneas 24-28):

```ts
  /**
   * Las plantillas que el dueño puede elegir, derivadas del registry en vez de escritas a mano.
   * Era la 4ta copia de la misma constante, y estaba desactualizada en las dos puntas: no ofrecía la
   * E —construida y andando— y describía a la B como "hero centrado", que es lo que era antes de
   * volverse la nocturna.
   *
   * `CODIGOS_CON_SHELL` y no `CODIGOS_PLANTILLA`: el catálogo lista las cinco porque el back las
   * acepta, pero D todavía no tiene cáscara y `shellDePlantilla()` la manda a la A. Ofrecerla sería
   * dejar que el dueño elija algo que se ve como otra cosa. Cuando D exista, aparece sola.
   */
  readonly plantillas = CODIGOS_CON_SHELL.map((c) => ({
    value: c,
    label: `${c} · ${PLANTILLAS[c].nombre}`,
    hint: PLANTILLAS[c].descripcion,
  }));
```

Agregar el import correspondiente.

- [ ] **Step 2: Verificar el build**

Run: `npm run build`
Esperado: limpio. Anotar el número del bundle: importar el registry desde el panel puede moverlo, y si lo mueve hay que decir cuánto.

- [ ] **Step 3: Correr los unit**

Run: `npm test`
Esperado: **PASS**. Si algún spec de `tab-club` afirmaba que hay 3 opciones, actualizarlo a 4 — es un cambio de expectativa correcto, no una relajación.

- [ ] **Step 4: Verificarlo de punta a punta a mano**

Con el back mergeado y arriba: entrar al panel del tenant demo, ir a "Tu club", confirmar que el selector ofrece **A, B, C y E** con los nombres del registry (Afiche, Nocturna, Tarjeta, Diurna), elegir **E**, guardar, y abrir `http://demo.localhost:4400/` para confirmar que la landing sale con la diurna. Después dejarlo como estaba.

Si back #5 no está mergeado, el guardado va a fallar con un rechazo de validación: **eso es lo esperado**, no un bug de esta tarea. Reportarlo como pendiente de verificación, sin fingir que pasó.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/config/tabs/tab-club/
git commit -m "feat(config): el selector de plantillas sale del registry y ofrece la E"
```

---

## Puerta final de la rama

Después de la Task 8, antes de dar el trabajo por cerrado:

- [ ] `npm test` — verde, con el total esperado (base + 1 de la Task 2 + 1 de la Task 4 + 1 de la Task 6, más lo que sumen los ajustes de specs).
- [ ] `npm run build` — limpio, con el número del bundle anotado y explicado si se movió.
- [ ] `npx playwright test e2e` — **21 passed**, y la línea del teardown al final.
- [ ] Correr la suite **dos veces seguidas** y que las dos den verde: es la prueba de que la Task 1 sostiene todo lo demás.
- [ ] **Revisión visual en los 4 anchos (360 · 390 · 768 · 1280) de las cuatro plantillas.** Esta rama mueve A, B y C a propósito; hay que mirarlas, no sólo medirlas.
- [ ] **La tabla de movimiento acumulado**: por cada plantilla, cuántos pixels se movieron contra `main` y a qué regla corresponde cada grupo. Un grupo sin dueño es un hallazgo, no un redondeo.
- [ ] Review de rama completa con un agente fresco.
