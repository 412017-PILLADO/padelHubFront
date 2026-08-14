# Plantillas visuales — Plan 1: base arquitectónica

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la landing lista para tener cinco pieles: el flujo de reserva sale del monolito a componentes reusables, cada plantilla pasa a ser un shell con su carpeta y sus tokens, y el back acepta los códigos `D` y `E` — **sin que cambie un solo pixel de lo que ve el visitante**.

**Architecture:** Tres etapas encadenadas. **Etapa A** (Tasks 1-5, 10) es puro movimiento e indirección: dos stores (`ClubStore` / `BookingStore`) y cuatro componentes (`booking-flow`, `club-info`, `brand-mark`, `landing-footer`) salen de `landing.ts`/`landing.html`, y las plantillas A/B/C pasan a ser shells cargados por un dispatcher. Se conservan clases, DOM y estilos: la prueba de que salió bien es que los e2e existentes pasan **sin tocarlos**. **Etapa B** (Tasks 6-8) agrega la infraestructura nueva: registry de plantillas, capa de tokens, tipografía por plantilla vía SSR, cálculo de tinta dark-safe y clave de caché con plantilla. **Etapa C** (Task 9) habilita `D` y `E` en el back.

**Tech Stack:** Angular 21 standalone + signals + SSR · PrimeNG 21 · SCSS · Vitest (`@angular/build:unit-test`) · Playwright 1.61 · Spring Boot (padelBack).

## Global Constraints

- Repo `padelFront`, rama **`feat/plantillas-visuales`** (ya creada; la spec está commiteada ahí en `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md`). El Task 9 toca `padelBack`, que es **otro repo** — rama `feat/plantillas-de` ahí.
- **Spec de referencia obligatoria:** `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md`. Las decisiones de §2 están cerradas por el owner: no re-decidir.
- **Sin dependencias nuevas.** Comentarios, nombres y mensajes de commit **en español**.
- Todo componente nuevo: `standalone: true` + `ChangeDetectionStrategy.OnPush`.
- **SSR:** la landing se renderiza en server (`RenderMode.Server`). Nada de `window`/`localStorage`/`document` global sin guardar con `isPlatformBrowser`; el `DOCUMENT` va **inyectado**, nunca el global (es el patrón que ya usan `landing.ts:115` y `branding.service.ts:25`).
- **Etapa A no cambia pixels.** Se mueven clases, atributos y estructura DOM tal cual. Si algo *parece* mejorable, se anota y se deja para el Plan 2.
- **Prohibido tocar los specs e2e existentes en los Tasks 1-5.** Son la prueba de que el refactor no rompió nada. Si un spec falla, se arregla el código, no el spec.
- Verificación de cada task: `npm run build` verde **y** `npx playwright test e2e` verde (suite completa; hoy 20 tests).
- **Playwright se corre SIEMPRE con el path `e2e`** (`npx playwright test e2e`). Sin el path, el runner escanea `src/`, `.claude/` y el proyecto hermano `BarberApp`, carga dos `@playwright/test` y se corrompe ("did not expect test()").
- Pre-requisitos para los e2e: MySQL arriba (`docker compose up -d` en `padelBack`, puerto 3308) y backend en **:8095** (`e2e/helpers.ts:3`). El front lo levanta el propio Playwright en :4400 — **no** dejar un `ng serve` propio ocupando ese puerto.
- Unit tests: `npm test` (builder `@angular/build:unit-test`, corre todos los `*.spec.ts` de `src/`).

### Convención de "movimiento verbatim" (Tasks 1-5)

Varios steps dicen **mover** bloques existentes en vez de mostrar el código completo. Es deliberado y **no es un placeholder**: el código ya existe, tiene comentarios largos que valen y transcribirlo a mano en este plan sólo agregaría riesgo de error de copiado.

Regla para esos steps: **cortar y pegar sin editar** (ni renombrar, ni reordenar, ni "aprovechar y limpiar"), y ajustar únicamente lo que el compilador exija (imports y `this.` → referencia al store). La verificación es doble: los e2e pasan sin tocarse, y `git show --stat` del commit muestra un saldo de líneas cercano a cero entre el archivo origen y el destino.

---

### Task 1: `ClubStore` — quién es este club

Saca de `landing.ts` todo lo que responde "qué club es éste": config pública, derivados, params de preview, SEO y branding. Queda un servicio que el shell consume y el flujo de reserva ignora.

**Files:**
- Create: `src/app/features/landing/club.store.ts`
- Create: `src/app/features/landing/club.store.spec.ts`
- Modify: `src/app/features/landing/landing.ts` (saca líneas 120-186, 439-524 y el helper de horarios de 790-826)

**Interfaces:**
- Consumes: `BookingService.config()`, `PublicConfig` (`src/app/core/api/booking.service.ts`), `applyTenantColors` (`src/app/core/branding/tenant-colors.ts`).
- Produces:
  ```ts
  @Injectable() export class ClubStore {
    readonly config: Signal<PublicConfig | null>;
    readonly tenantNombre: Signal<string>;        // 'Tu club' si no cargó
    readonly tenantPrimerNombre: Signal<string>;
    readonly plantilla: Signal<string>;           // 'A'..'E', default 'A'
    readonly logoSrc: Signal<string | null>;
    readonly horarios: Signal<HoursRow[]>;
    readonly direccion: Signal<string | null>;
    readonly mapaUrl: Signal<string | null>;
    readonly whatsappUrl: Signal<string | null>;
    readonly instagramHandle: Signal<string | null>;
    readonly instagramUrl: Signal<string | null>;
    readonly mostrarPrecios: Signal<boolean>;
    readonly requiereTelefono: Signal<boolean>;
    readonly requiereSena: Signal<boolean>;
    readonly senaMonto: Signal<number | null>;
    readonly senaMontoFmt: Signal<string | null>;
    readonly senaAlias: Signal<string | null>;
    readonly politicaCancelacion: Signal<string | null>;
    /** Estado del fetch. `error` es un estado propio y no "config sigue en null": el flujo de
     *  reserva necesita distinguirlos para arrancar con sus defaults y avisarle al visitante. */
    readonly estadoCarga: Signal<'idle' | 'cargando' | 'ok' | 'error'>;
    cargar(): void;                               // fetch + branding + SEO (idempotente)
    setPreviewPlantilla(tpl: string): void;
  }
  export interface HoursRow { dias: string; rango: string; cerrado: boolean; }
  export function agruparHorarios(horarios: PublicConfig['horarios']): HoursRow[];
  ```
  `agruparHorarios` se exporta aparte porque es pura y el test la ataca sola.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/features/landing/club.store.spec.ts`:

```ts
import { agruparHorarios } from './club.store';

describe('agruparHorarios', () => {
  it('agrupa días consecutivos con el mismo rango en una sola fila', () => {
    // diaSemana: 0=Lunes .. 6=Domingo (contrato de /public/config)
    const filas = agruparHorarios([
      { diaSemana: 0, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 1, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 2, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 5, horaInicio: '10:00', horaFin: '20:00' },
    ]);
    expect(filas[0]).toEqual({ dias: 'Lun a Mié', rango: '09:00 a 23:00', cerrado: false });
    expect(filas.some((f) => f.cerrado)).toBe(true);
  });

  it('marca cerrado el día sin horario', () => {
    const filas = agruparHorarios([{ diaSemana: 0, horaInicio: '09:00', horaFin: '23:00' }]);
    const cerrados = filas.filter((f) => f.cerrado);
    expect(cerrados.length).toBeGreaterThan(0);
    expect(cerrados[0].rango).toBe('Cerrado');
  });
});
```

> **Antes de escribir el `expect`:** abrí `landing.ts:790-826` y copiá el formato **exacto** que produce hoy la función (separador de días, texto de cerrado, formato del rango). Este test caracteriza el comportamiento actual — si tu expectativa no coincide con lo que hace el código de hoy, gana el código de hoy y corregís el test.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `Failed to resolve import "./club.store"`.

- [ ] **Step 3: Crear `club.store.ts` moviendo el código**

Crear el archivo con:
1. `HoursRow`, `DIAS`, `agruparHorarios` — **movidos verbatim** desde `landing.ts:41-51` y `790-826` (hoy es una función suelta al final del archivo).
2. La clase `ClubStore` con `@Injectable()` (sin `providedIn`: la provee el dispatcher, ver Task 5), conteniendo:
   - `config`, `tenantNombre`, `tenantPrimerNombre`, `plantilla`, `previewPlantilla`, `previewColor`, `logoSrc`, `horarios`, `direccion`, `mapaUrl`, `whatsappRaw`, `whatsappUrl`, `instagramHandle`, `instagramUrl`, `mostrarPrecios`, `requiereTelefono`, `requiereSena`, `senaMonto`, `senaMontoFmt`, `senaAlias` — **movidos verbatim** de `landing.ts:120-186`.
   - `readPreviewParams`, `setPreviewPlantilla`, `loadConfig` (renombrado a `cargar`), `applyBranding`, `applySeo` — **movidos verbatim** de `landing.ts:439-524`.
3. Los `inject()` que esos métodos necesitan: `BookingService`, `PLATFORM_ID`, `DOCUMENT`, `Title`, `Meta`.

`cargar()` es idempotente: si ya hay `config()` cargada, retorna sin hacer nada.

**Ojo — `loadConfig` mezcla dos responsabilidades.** Su `subscribe` hace, además del fetch y el branding, tres cosas que son del flujo de reserva: `duracion.set(cfg.duracionDefault)` e `initDefaultDay()` en el camino feliz, y `duracion.set(90)` + `initDefaultDay()` + un toast de error en el otro. Esas tres **no** van a `ClubStore` (no inyecta `MessageService` ni conoce la duración).

La separación: `cargar()` mueve `estadoCarga` a `'cargando'` al empezar y a `'ok'`/`'error'` al terminar, y en `Landing` un `effect()` sobre `estadoCarga()` dispara lo del flujo — con el toast copiado **literal** del `error:` de hoy. En el Task 2 ese mismo effect se muda a `BookingStore` sin cambios. Se usa una señal de estado y no un callback justamente para que esa mudanza sea un corte y pegue.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 3 tests (el `app.spec.ts` existente + los 2 nuevos).

- [ ] **Step 5: Enganchar `landing.ts` al store**

En `landing.ts`: borrar los miembros movidos, inyectar `private readonly club = inject(ClubStore)` y re-exponer lo que el template usa hoy como alias, para **no tocar `landing.html` en este task**:

```ts
readonly config = this.club.config;
readonly tenantNombre = this.club.tenantNombre;
readonly tenantPrimerNombre = this.club.tenantPrimerNombre;
readonly plantilla = this.club.plantilla;
readonly logoSrc = this.club.logoSrc;
readonly horarios = this.club.horarios;
readonly direccion = this.club.direccion;
readonly mapaUrl = this.club.mapaUrl;
readonly whatsappUrl = this.club.whatsappUrl;
readonly instagramHandle = this.club.instagramHandle;
readonly instagramUrl = this.club.instagramUrl;
readonly mostrarPrecios = this.club.mostrarPrecios;
readonly requiereTelefono = this.club.requiereTelefono;
readonly requiereSena = this.club.requiereSena;
readonly senaMonto = this.club.senaMonto;
readonly senaMontoFmt = this.club.senaMontoFmt;
readonly senaAlias = this.club.senaAlias;
```

Agregar `ClubStore` a `providers: [MessageService, ClubStore]` del `@Component`, y en el `constructor` reemplazar la llamada a `this.loadConfig()` por `this.club.cargar()`.

- [ ] **Step 6: Verificar que nada se rompió**

```bash
npm run build
npx playwright test e2e
```

Esperado: build verde; Playwright **20 passed**. Si algún test falla, el problema está en el movimiento — arreglá el código, no el spec.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/landing/club.store.ts src/app/features/landing/club.store.spec.ts src/app/features/landing/landing.ts
git commit -m "refactor(landing): extrae ClubStore con la identidad del club"
```

---

### Task 2: `BookingStore` — qué está reservando este visitante

**Files:**
- Create: `src/app/features/landing/booking/booking.store.ts`
- Create: `src/app/features/landing/booking/booking.store.spec.ts`
- Modify: `src/app/features/landing/landing.ts`

**Interfaces:**
- Consumes: `ClubStore` (Task 1) para `config`, `estadoCarga`, `requiereTelefono`, `mostrarPrecios`; `BookingService.disponibilidad()`, `.crearReserva()`, `.crearLinkSena()`.
- **Se muda acá el `effect()` sobre `estadoCarga`** que el Task 1 dejó en `Landing` (duración default + día inicial en `'ok'`; defaults + toast en `'error'`). Es un corte y pegue: el `MessageService` se inyecta ahora en `BookingStore`.
- Produces:
  ```ts
  @Injectable() export class BookingStore {
    // selección
    readonly duracion: WritableSignal<number>;
    readonly selectedDay: WritableSignal<Date | null>;
    readonly selectedTime: WritableSignal<string | null>;
    readonly selectedCancha: WritableSignal<number | null>;
    readonly ANY: -1;
    // datos del cliente
    readonly nombre: WritableSignal<string>;
    readonly whatsapp: WritableSignal<string>;
    readonly nombreTouched: WritableSignal<boolean>;
    readonly whatsappTouched: WritableSignal<boolean>;
    // derivados
    readonly slots: Signal<Slot[]>;
    readonly loadingSlots: Signal<boolean>;
    readonly stepNums: Signal<Record<string, number>>;
    readonly showDuracion: Signal<boolean>;
    readonly showCancha: Signal<boolean>;
    readonly showTimes: Signal<boolean>;
    readonly canConfirm: Signal<boolean>;
    readonly confirmBlockedReason: Signal<string | null>;
    readonly recap: Signal<{ dia: string; hora: string; duracion: string; cancha: string } | null>;
    readonly precioResumen: Signal<{ texto: string; desde: boolean } | null>;
    readonly success: Signal<boolean>;
    readonly successData: Signal<TSuccess | null>;  // TSuccess = el tipo literal de landing.ts:244-256, copiado tal cual
    // acciones
    pickDuracion(d: number): void;
    selectDay(date: Date): void;
    selectTime(slot: Slot): void;
    selectCancha(id: number): void;
    confirm(): void;
    backHome(): void;
    copyAlias(): void;
  }
  ```

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/features/landing/booking/booking.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { BookingService } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { BookingStore } from './booking.store';

/** Doble del servicio: el store no debe pegarle a la red para validar el formulario. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
  crearReserva: () => of(null as never),
  crearLinkSena: () => of({ initPoint: '' }),
};

describe('BookingStore · validación del formulario', () => {
  let store: BookingStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingService, useValue: bookingFalso },
        ClubStore,
        BookingStore,
      ],
    });
    store = TestBed.inject(BookingStore);
  });

  it('no deja confirmar sin cancha elegida', () => {
    store.nombre.set('Mateo');
    store.whatsapp.set('3515123456');
    expect(store.canConfirm()).toBe(false);
    expect(store.confirmBlockedReason()).not.toBeNull();
  });

  it('rechaza un nombre de menos de 2 caracteres', () => {
    store.nombre.set('M');
    store.selectedCancha.set(store.ANY);
    expect(store.canConfirm()).toBe(false);
  });

  it('habilita confirmar con nombre, teléfono y cancha', () => {
    store.nombre.set('Mateo');
    store.whatsapp.set('3515123456');
    store.selectedCancha.set(store.ANY);
    expect(store.canConfirm()).toBe(true);
    expect(store.confirmBlockedReason()).toBeNull();
  });
});
```

> Si el proyecto no usa zoneless, sacá `provideZonelessChangeDetection()`. Verificá en `src/app/app.config.ts` cuál es el provider de change detection y usá el mismo.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `Failed to resolve import "./booking.store"`.

- [ ] **Step 3: Crear `booking.store.ts` moviendo el código**

Mover **verbatim** desde `landing.ts`:
- Estado y derivados: líneas 183-236 (duraciones, duración, `showDuracion`, `showCancha`, `stepNums`, día, calendario, slots, cancha, datos del cliente), 268-412 (chips, validaciones, `confirmBlockedReason`, `precioResumen`, `precioEsEspecial`, `recap`, `timeHint`, `showTimes`), 243-267 (éxito + seña).
- Métodos: 525-560, 569-650 (`initDefaultDay`, `pickDuracion`, `chipDate`, `isChipSelected`, `selectDay`, `toggleCalendar`, `onPickerSelect`, `apiFecha`, `loadAvailability`, `selectTime`, `selectCancha`, `isCanchaSelected`, `canchaTipo`, `materialLabel`, `precioTurno`), 650-790 (`confirm`, `fmtRecapDay`, `recapDay`, `backHome`, `copyAlias`).
- Los helpers de fecha sueltos `startOfDay`/`addDays`/`sameDay` (`landing.ts:71-89`) van con ellos.

Donde el código movido leía `this.config()`, `this.requiereTelefono()`, `this.mostrarPrecios()`, `this.senaAlias()`, etc., pasa a leer `this.club.config()` con `private readonly club = inject(ClubStore)`.

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Enganchar `landing.ts` al store**

Igual que en Task 1: borrar los miembros movidos, inyectar `BookingStore`, re-exponer alias con los mismos nombres que usa `landing.html`, agregar `BookingStore` a `providers`. **`landing.html` sigue sin tocarse.**

- [ ] **Step 6: Verificar**

```bash
npm run build
npx playwright test e2e
```

Esperado: build verde; **20 passed**. Este es el task de mayor riesgo del plan: si algo se rompe, mirá primero `confirm()` y `loadAvailability()`, que son los que más `this.` cruzados tenían.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/landing/booking/ src/app/features/landing/landing.ts
git commit -m "refactor(landing): extrae BookingStore con el estado de la reserva"
```

---

### Task 3: Componente `<app-booking-flow>`

**Files:**
- Create: `src/app/features/landing/booking/booking-flow.ts`
- Create: `src/app/features/landing/booking/booking-flow.html`
- Create: `src/app/features/landing/booking/booking-flow.scss`
- Modify: `src/app/features/landing/landing.html` (saca 21-312)
- Modify: `src/app/features/landing/landing.scss` (saca las reglas del flujo)

**Interfaces:**
- Consumes: `BookingStore`, `ClubStore` (inyectados, sin `@Input`).
- Produces: selector `app-booking-flow`. **El DOM y las clases que emite son idénticos a los de hoy** — `.booking-flow`, `.step`, `.step-head`, `.dur-chips .chip`, `.days .chip`, `.times .slot`, `.ccard`, `.ccard.any`, `#fName`, `#fPhone`, `.confirm`, `.recap`, `.success.open`. Son el contrato que verifican `plantillas.spec.ts` y `reserva.spec.ts`.

- [ ] **Step 1: Crear el componente con el template movido**

`booking-flow.html` = **exactamente** el contenido de `landing.html:22-311` (lo de adentro del `<ng-template #bookingFlow>`, sin las etiquetas del template).

`booking-flow.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { ClubStore } from '../club.store';
import { BookingStore } from './booking.store';

/**
 * Los pasos de la reserva: duración, día, horario, cancha y datos. Es el corazón funcional de la
 * landing y NO tiene identidad visual propia — se pinta con los tokens `--flow-*` que declara el
 * shell de cada plantilla (ver la spec de plantillas, §4). No agregar acá reglas que dependan de
 * una plantilla en particular.
 */
@Component({
  selector: 'app-booking-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePicker],
  templateUrl: './booking-flow.html',
  styleUrl: './booking-flow.scss',
})
export class BookingFlowComponent {
  protected readonly club = inject(ClubStore);
  protected readonly st = inject(BookingStore);
}
```

> Los `imports` de arriba son un punto de partida: mirá el array `imports` real de `landing.ts:94-103` y quedate con los módulos que el template movido efectivamente usa. Si el template referencia miembros directo (`selectDay(...)`), agregá alias `protected readonly selectDay = this.st.selectDay.bind(this.st)` en vez de editar el HTML — el objetivo del task es no tocar el markup.

- [ ] **Step 2: Mover los estilos del flujo**

De `landing.scss`, mover a `booking-flow.scss` las reglas de `.booking-flow`, `.step*`, `.dur-chips`, `.days`, `.times`, `.slot`, `.ccard*`, `.form*`, `.confirm`, `.recap`, `.success*`, `.sena*` — todo lo que estiliza los pasos y no la cáscara.

**Ojo con la encapsulación:** el componente nuevo tiene estilos scopeados, así que reglas de la cáscara que hoy le pegan de afuera al flujo (`.tpl-b .booking-flow { … }`, `.tpl-c .flow-head .mono { display: none }`) **dejan de aplicar**. En este task se conservan tal cual usando `::ng-deep` desde el shell, o dejando esas reglas en `landing.scss` con `ViewEncapsulation.None` en el componente. Elegí `ViewEncapsulation.None` para el flujo: es lo que menos cambia hoy, y en el Plan 2 esas reglas desaparecen al reemplazarlas por tokens.

- [ ] **Step 3: Usar el componente desde `landing.html`**

Reemplazar los tres `<ng-container [ngTemplateOutlet]="bookingFlow">` (líneas 386, 427 y el de la plantilla A) por `<app-booking-flow />`, y borrar el `<ng-template #bookingFlow>` completo (21-312). Agregar `BookingFlowComponent` a los `imports` de `landing.ts`.

- [ ] **Step 4: Verificar que el DOM no cambió**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. Estos specs tocan `.dur-chips .chip`, `.times .slot`, `.ccard.any`, `#fName`, `.confirm`, `.success.open` y `.recap`: si pasan, el contrato del markup se mantuvo.

- [ ] **Step 5: Revisión visual obligatoria**

Levantá el front (`npm start -- --port 4400 --host localhost`) y abrí `http://demo.localhost:4400/`. Comparar contra una captura previa en **390×844** y **1440×900**. Buscar específicamente: paddings del contenedor del flujo, radio de las tarjetas de cancha y separación entre pasos — es donde pega la encapsulación de estilos.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/
git commit -m "refactor(landing): el flujo de reserva pasa a componente propio"
```

---

### Task 4: Componentes `<app-club-info>`, `<app-brand-mark>` y `<app-landing-footer>`

Mata las tres copias del footer y deja una sola implementación de la info del club para B y C. **La info bespoke de la plantilla A no se toca** (su markup es distinto: `.info-block/.hours/.link-row`); se unifica en el Plan 2, cuando se pueda comparar el pixel.

**Files:**
- Create: `src/app/features/landing/club/club-info.ts` (+ `.html`, `.scss`)
- Create: `src/app/features/landing/club/brand-mark.ts`
- Create: `src/app/features/landing/club/landing-footer.ts` (+ `.html`, `.scss`)
- Modify: `src/app/features/landing/landing.html`, `landing.ts`, `landing.scss`

**Interfaces:**
- Consumes: `ClubStore`.
- Produces:
  - `app-club-info` → emite `.ic-card`, `.ic-h`, `.ic-hours`, `.ic-addr`, `.ic-links`, `.ic-link`, `.ic-link-svg` (idéntico a `landing.html:315-354`).
  - `app-brand-mark` → emite `.tpl-logo` con el logo del club o el de Padel Hub (idéntico a `landing.html:357-363`).
  - `app-landing-footer` → recibe `class` desde el shell (`b-foot`, `c-foot`, `pb-foot`) y emite adentro `.foot-copy` + `.foot-links` con arrepentimiento, política y "Panel del club".
    ```ts
    @Component({ selector: 'app-landing-footer', … })
    export class LandingFooterComponent {
      readonly abrirArrepentimiento = output<void>();
      readonly abrirPolitica = output<void>();
    }
    ```

- [ ] **Step 1: Crear `club-info` y `brand-mark`**

Mover verbatim `landing.html:315-354` a `club-info.html` y `357-363` a un template inline en `brand-mark.ts`. Mover de `landing.scss` las reglas `.ic-*` y `.tpl-logo`/`.tpl-mark`.

- [ ] **Step 2: Crear `landing-footer`**

El template sale de cualquiera de las tres copias (`landing.html:393-402`, `431-440`, `527-536`) — son idénticas salvo la clase del contenedor. El contenedor pasa a ser responsabilidad del shell:

```html
<span class="mono foot-copy">© 2026 {{ club.tenantNombre() }}</span>
<span class="foot-links">
  <button type="button" class="arrep-link" (click)="abrirArrepentimiento.emit()">Botón de arrepentimiento</button>
  @if (club.config()?.politicaCancelacion) {
    <button type="button" class="politica-link" (click)="abrirPolitica.emit()">Política de cancelación</button>
  }
  <a class="mono" routerLink="/admin">Panel del club</a>
</span>
```

**Cuidado con la plantilla A:** su `.panel-link` lleva una clase extra (`landing.html:534`). Conservala en el componente — si no, cambia el estilo del link en el afiche.

- [ ] **Step 3: Reemplazar los tres usos**

En `landing.html`: los `<ng-container [ngTemplateOutlet]="infoCards">` pasan a `<app-club-info />`, los de `brandMark` a `<app-brand-mark />`, y los tres `<footer class="X">…</footer>` a `<app-landing-footer class="X" (abrirArrepentimiento)="abrirArrepentimiento()" (abrirPolitica)="abrirPolitica()" />`.

Para que el `class` del host aplique como hoy, el footer necesita `:host { display: flex; … }` con lo que tenían `.b-foot`/`.c-foot`/`.pb-foot` en común, y cada shell conserva sus diferencias.

- [ ] **Step 4: Verificar**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed** (`arrepentimiento.spec.ts` cubre el botón del footer: es el que valida este task).

- [ ] **Step 5: Revisión visual en las tres plantillas**

```
http://acepadel.localhost:4400/    → A
http://costapadel.localhost:4400/  → B
http://urbanpadel.localhost:4400/  → C
```

En 390×844 y 1440×900. Mirar el footer de las tres y la info del club en B y C.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/
git commit -m "refactor(landing): unifica info del club, marca y footer en componentes"
```

---

### Task 5: Shells por plantilla + dispatcher

**Files:**
- Create: `src/app/features/landing/shells/a-afiche/shell.ts` (+ `.html`, `.scss`)
- Create: `src/app/features/landing/shells/b-nocturna/shell.ts` (+ `.html`, `.scss`)
- Create: `src/app/features/landing/shells/c-tarjeta/shell.ts` (+ `.html`, `.scss`)
- Modify: `src/app/features/landing/landing.ts`, `landing.html`, `landing.scss`

> Los nombres de carpeta ya son los definitivos de la spec (§6), aunque en este task el contenido siga siendo el diseño viejo. Renombrar después costaría un commit de puro ruido.

**Interfaces:**
- Consumes: `ClubStore`, `BookingFlowComponent`, `ClubInfoComponent`, `BrandMarkComponent`, `LandingFooterComponent`.
- Produces: cada shell exporta una clase con selector `app-shell-<x>` y emite su elemento raíz con la clase que hoy usan los e2e: `.poster` (A), `.tpl-b` (B), `.tpl-c` (C). `landing.ts` conserva `host: { '[attr.data-tpl]': 'plantilla()' }` — `plantillas.spec.ts:63` lo verifica.

- [ ] **Step 1: Crear los tres shells**

Cada `shell.html` sale del `@case`/`@default` correspondiente de `landing.html` (B: 369-403 · C: 408-441 · A: 446-~545), sin el `<div class="tpl-b">` exterior — ése pasa a ser el host del componente vía `host: { class: 'tpl-b' }`.

Cada `shell.scss` se lleva de `landing.scss` el bloque de su plantilla: A las reglas `.poster*`, `.pb-*`, `.watermark`, `.info-block`, `.hours`, `.link-row`; B el bloque de `landing.scss:672-750`; C el de `752-800` y sus media queries.

Los estilos que quedan compartidos (tipografía base, `.eyebrow`, `.mono`, modales) se quedan en `landing.scss`.

- [ ] **Step 2: Convertir `landing.ts` en dispatcher**

`landing.html` queda:

```html
@switch (plantilla()) {
  @case ('B') { <app-shell-b /> }
  @case ('C') { <app-shell-c /> }
  @default { <app-shell-a /> }
}
<app-arrepentimiento-modal … />
<app-politica-modal … />
```

Los modales y el `MessageService` se quedan en el dispatcher: son transversales a las plantillas.

- [ ] **Step 3: Verificar**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. `plantillas.spec.ts` verifica `[data-tpl="A|B|C"]` **y** `.poster`/`.tpl-b`/`.tpl-c` visibles: es exactamente el contrato de este task.

- [ ] **Step 4: Revisión visual de las tres, 390 y 1440**

Misma comparación que en Task 4. Esta es la última oportunidad de detectar un cambio de pixel antes de que empiece el rediseño: a partir de acá, las diferencias visuales van a ser intencionales y va a costar distinguirlas de una regresión.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/
git commit -m "refactor(landing): cada plantilla es un shell y landing queda de dispatcher"
```

---

### Task 6: Registry de plantillas + tipografía por SSR

Primera pieza nueva: la lista de plantillas deja de estar hardcodeada en un `@switch` y pasa a ser dato.

**Files:**
- Create: `src/app/core/landing/plantillas.ts`
- Create: `src/app/core/landing/plantillas.spec.ts`
- Create: `src/app/core/landing/fuentes.ts`
- Modify: `src/app/features/landing/landing.ts` (dispatcher usa el registry)
- Modify: `src/index.html` (saca el `<link>` global de fuentes)
- Modify: `src/app/app.config.ts` (fuentes de plataforma para panel/marketing)

**Interfaces:**
- Produces:
  ```ts
  export type CodigoPlantilla = 'A' | 'B' | 'C' | 'D' | 'E';
  export interface Plantilla {
    codigo: CodigoPlantilla;
    nombre: string;                 // 'Afiche' — el que ve el club en la galería
    descripcion: string;            // 'Editorial, marca grande'
    esquema: 'light' | 'dark';
    inkHex: string;                 // tinta base del shell, para decidirTinta()
    fuentes: string[];              // familias de Google Fonts
    claseShell: string;             // '.poster' | 'tpl-b' | …
  }
  export const PLANTILLAS: Record<CodigoPlantilla, Plantilla>;
  export const CODIGOS_PLANTILLA: CodigoPlantilla[];
  export function normalizarPlantilla(v: string | null | undefined): CodigoPlantilla; // default 'A'
  export function urlFuentes(fuentes: string[]): string;  // URL css2 de Google Fonts
  ```

- [ ] **Step 1: Escribir el test que falla**

`src/app/core/landing/plantillas.spec.ts`:

```ts
import { CODIGOS_PLANTILLA, PLANTILLAS, normalizarPlantilla, urlFuentes } from './plantillas';

describe('registry de plantillas', () => {
  it('tiene las cinco plantillas con datos completos', () => {
    expect(CODIGOS_PLANTILLA).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const codigo of CODIGOS_PLANTILLA) {
      const p = PLANTILLAS[codigo];
      expect(p.nombre.length).toBeGreaterThan(0);
      expect(p.fuentes.length).toBeGreaterThan(0);
      expect(['light', 'dark']).toContain(p.esquema);
      expect(p.inkHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('B es la única oscura', () => {
    const oscuras = CODIGOS_PLANTILLA.filter((c) => PLANTILLAS[c].esquema === 'dark');
    expect(oscuras).toEqual(['B']);
  });

  it('E reusa el par tipográfico de B (no agrega fuentes al catálogo)', () => {
    expect(PLANTILLAS.E.fuentes).toEqual(PLANTILLAS.B.fuentes);
  });

  it('normaliza cualquier basura a la plantilla A', () => {
    expect(normalizarPlantilla('b')).toBe('B');
    expect(normalizarPlantilla('Z')).toBe('A');
    expect(normalizarPlantilla(null)).toBe('A');
    expect(normalizarPlantilla('')).toBe('A');
  });

  it('arma la URL de Google Fonts con todas las familias', () => {
    const url = urlFuentes(['Anton', 'Inter Tight']);
    expect(url).toContain('family=Anton');
    expect(url).toContain('family=Inter+Tight');
    expect(url).toContain('display=swap');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — no existe `./plantillas`.

- [ ] **Step 3: Implementar el registry**

```ts
/**
 * Catálogo de plantillas de landing. Única fuente de verdad sobre "qué plantillas existen": la
 * consumen el dispatcher, la inyección de fuentes, la galería del panel y la sección de
 * personalización de marketing. Sin dependencias de Angular a propósito, para poder usarse desde
 * cualquiera de esos lugares sin arrastrar árboles ajenos.
 */
export type CodigoPlantilla = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Plantilla {
  codigo: CodigoPlantilla;
  nombre: string;
  descripcion: string;
  esquema: 'light' | 'dark';
  /** Tinta base del shell. La usa decidirTinta() para elegir texto legible sobre el color del club. */
  inkHex: string;
  fuentes: string[];
  claseShell: string;
}

/** Tinta oscura del sistema (matchea --ink en styles.scss). */
const INK_OSCURA = '#11162b';
/** Tinta clara de la plantilla oscura. */
const INK_CLARA = '#eef2f8';

export const PLANTILLAS: Record<CodigoPlantilla, Plantilla> = {
  A: { codigo: 'A', nombre: 'Afiche',   descripcion: 'Editorial, marca grande',   esquema: 'light', inkHex: INK_OSCURA, fuentes: ['Archivo', 'Hanken Grotesk', 'Space Mono'], claseShell: 'poster' },
  B: { codigo: 'B', nombre: 'Nocturna', descripcion: 'Oscura, luz de cancha',     esquema: 'dark',  inkHex: INK_CLARA,  fuentes: ['Anton', 'Inter Tight', 'JetBrains Mono'],   claseShell: 'tpl-b' },
  C: { codigo: 'C', nombre: 'Tarjeta',  descripcion: 'Tipo app, para el pulgar',  esquema: 'light', inkHex: INK_OSCURA, fuentes: ['Outfit', 'Inter'],                          claseShell: 'tpl-c' },
  D: { codigo: 'D', nombre: 'Cancha',   descripcion: 'Líneas y tablero',          esquema: 'light', inkHex: INK_OSCURA, fuentes: ['IBM Plex Sans', 'IBM Plex Mono'],           claseShell: 'tpl-d' },
  E: { codigo: 'E', nombre: 'Diurna',   descripcion: 'Clara, vidrio sobre color', esquema: 'light', inkHex: INK_OSCURA, fuentes: ['Anton', 'Inter Tight', 'JetBrains Mono'],   claseShell: 'tpl-e' },
};

export const CODIGOS_PLANTILLA = Object.keys(PLANTILLAS) as CodigoPlantilla[];

/** Normaliza a un código válido; cualquier cosa rara cae en la plantilla por defecto. */
export function normalizarPlantilla(v: string | null | undefined): CodigoPlantilla {
  const up = (v ?? '').trim().toUpperCase();
  return (CODIGOS_PLANTILLA as string[]).includes(up) ? (up as CodigoPlantilla) : 'A';
}

/** URL de Google Fonts con todas las familias pedidas (los pesos van fijos: 400..800 + swap). */
export function urlFuentes(fuentes: string[]): string {
  const familias = fuentes.map((f) => `family=${f.trim().replace(/\s+/g, '+')}:wght@400;500;600;700;800`);
  return `https://fonts.googleapis.com/css2?${familias.join('&')}&display=swap`;
}
```

> **Verificá los pesos disponibles antes de dar por buena la URL:** `Anton` tiene un solo peso (400) y `Space Mono` sólo 400/700 — pedirles `500;600;700;800` devuelve 400 en Google Fonts, que es aceptable, pero si preferís URLs exactas agregá un campo `pesos` por familia al registry y usalo acá. Probá la URL generada en el browser antes de commitear.

- [ ] **Step 4: Correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 11 tests.

- [ ] **Step 5: Inyectar las fuentes según la plantilla**

Crear `src/app/core/landing/fuentes.ts`:

```ts
import { DOCUMENT } from '@angular/common';

/**
 * Agrega el <link> de fuentes al <head>. Corre también en SSR (el DOCUMENT inyectado se serializa),
 * así que el HTML que sale del server ya pide la tipografía correcta: sin esto, la plantilla
 * parpadea con la fuente del sistema hasta que hidrata. Idempotente por URL.
 */
export function cargarFuentes(doc: Document, url: string): void {
  if (doc.head.querySelector(`link[href="${url}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  doc.head.appendChild(link);
}
```

En cada shell (`shell.ts` de A, B y C), en el constructor:

```ts
private readonly doc = inject(DOCUMENT);
constructor() {
  cargarFuentes(this.doc, urlFuentes(PLANTILLAS.B.fuentes)); // el código de SU plantilla
}
```

En `src/index.html`, borrar el `<link>` de la línea 49 (**dejar** los dos `preconnect` de 47-48). En `app.config.ts`, cargar el trío de plataforma (`Archivo`, `Hanken Grotesk`, `Space Mono`) con la misma función, para que panel y marketing no se queden sin tipografía.

- [ ] **Step 6: Verificar que la landing pide sólo su fuente**

```bash
npm run build
npx playwright test e2e
```

Y a ojo, con las devtools en `http://costapadel.localhost:4400/` (plantilla B): en la pestaña Network debe pedirse **una** URL de `fonts.googleapis.com`, y el `<link>` tiene que estar en el HTML que devuelve el server (Ver código fuente, no el inspector) — si sólo aparece en el inspector, la inyección se está haciendo en cliente y hay que revisar el guard de SSR.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/landing/ src/index.html src/app/app.config.ts src/app/features/landing/
git commit -m "feat(landing): registry de plantillas y tipografía por plantilla vía SSR"
```

---

### Task 7: Cálculo de tinta dark-safe + matriz de contraste

**Files:**
- Modify: `src/app/core/branding/tenant-colors.ts`
- Create: `src/app/core/branding/tenant-colors.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DecisionTinta { usaBlanco: boolean; ratio: number; }
  /** Elige entre blanco y la tinta del shell evaluando el PEOR extremo del gradiente. */
  export function decidirTinta(fondoHex: string, inkHex: string): DecisionTinta;
  /** Wrapper para CSS: '#fff' o 'var(--ink)'. `inkHex` sale del registry de plantillas. */
  export function inkOnAccent(hex: string | null | undefined, inkHex?: string): string;
  export function applyTenantColors(
    root: CSSStyleDeclaration, primario?: string | null, secundario?: string | null, inkHex?: string,
  ): Record<string, string>;
  ```
  `inkHex` es opcional y cae en `#11162b`: las llamadas existentes (`branding.service.ts:61`) siguen compilando y comportándose igual.

- [ ] **Step 1: Escribir el test que falla**

`src/app/core/branding/tenant-colors.spec.ts`:

```ts
import { decidirTinta, inkOnAccent } from './tenant-colors';

const INK_OSCURA = '#11162b';
const INK_CLARA = '#eef2f8';

describe('decidirTinta · matriz de colores extremos', () => {
  // Umbral 4.5:1 (texto) para los colores que pueden alcanzarlo con dos tintas posibles.
  it.each([
    ['amarillo', '#FFD400'],
    ['blanco', '#FFFFFF'],
    ['negro', '#111111'],
  ])('%s alcanza 4.5:1 en el peor extremo del gradiente', (_nombre, color) => {
    expect(decidirTinta(color, INK_OSCURA).ratio).toBeGreaterThanOrEqual(4.5);
  });

  // Un fucsia saturado NO llega a 4.5:1 contra ninguna de las dos tintas (blanco 3.45, oscura 3.57
  // en el peor extremo). No es un bug del cálculo sino un límite del color: por eso la regla de
  // diseño es que ningún shell pone texto de párrafo sobre --court crudo (ver spec §10).
  it('fucsia alcanza al menos 3:1, el umbral de texto grande y componentes', () => {
    expect(decidirTinta('#FF2D95', INK_OSCURA).ratio).toBeGreaterThanOrEqual(3);
  });

  it('elige siempre la tinta con mejor peor-caso', () => {
    // Sobre amarillo gana la tinta oscura; sobre negro, el blanco.
    expect(decidirTinta('#FFD400', INK_OSCURA).usaBlanco).toBe(false);
    expect(decidirTinta('#111111', INK_OSCURA).usaBlanco).toBe(true);
  });

  it('en una plantilla oscura no devuelve la tinta clara sobre un color claro', () => {
    // Con ink claro (#eef2f8) sobre amarillo, blanco y la tinta del shell son ambos ilegibles:
    // la decisión correcta es el que tenga mejor ratio, nunca uno peor que el otro.
    const d = decidirTinta('#FFD400', INK_CLARA);
    const alternativa = decidirTinta('#FFD400', '#ffffff');
    expect(d.ratio).toBeGreaterThanOrEqual(Math.min(alternativa.ratio, d.ratio));
  });

  it('cae en blanco si el color no es parseable', () => {
    expect(inkOnAccent('no-es-un-color')).toBe('#fff');
    expect(inkOnAccent(null)).toBe('#fff');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `decidirTinta` no está exportada.

- [ ] **Step 3: Implementar**

En `tenant-colors.ts`, reemplazar el cuerpo de `inkOnAccent` (líneas 50-59) por:

```ts
export interface DecisionTinta {
  /** true = texto blanco; false = la tinta del shell. */
  usaBlanco: boolean;
  /** Contraste WCAG del peor extremo del gradiente con la tinta elegida. */
  ratio: number;
}

/**
 * Elige la tinta legible sobre un fondo del color del club, evaluando el PEOR de los dos extremos
 * del gradiente (el color base y `--court-deep`, 18% más oscuro): si no, un color en el límite
 * elige una tinta que se cae en la mitad oscura del degradé.
 *
 * `inkHex` es la tinta del shell — en una plantilla oscura es clara, así que NO se puede asumir
 * `#11162b` como antes: devolver `var(--ink)` ahí daría claro sobre claro.
 */
export function decidirTinta(fondoHex: string, inkHex: string): DecisionTinta {
  const rgb = hexToRgb(fondoHex);
  const ink = hexToRgb(inkHex);
  if (!rgb || !ink) return { usaBlanco: true, ratio: 0 };
  // `color-mix(in srgb, c 82%, #000)` = cada canal × 0.82.
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

/** Texto legible sobre el color del club, listo para CSS. `#fff` si el color no es parseable. */
export function inkOnAccent(hex: string | null | undefined, inkHex: string = DARK_INK_HEX): string {
  if (!hex || !hexToRgb(hex)) return '#fff';
  return decidirTinta(hex, inkHex).usaBlanco ? '#fff' : 'var(--ink)';
}
```

Agregar `const DARK_INK_HEX = '#11162b';` junto a `DARK_INK_RGB` (o reemplazarlo, ya que `hexToRgb` lo deriva). En `applyTenantColors`, agregar el cuarto parámetro `inkHex` y pasarlo a las dos llamadas de `inkOnAccent`.

- [ ] **Step 4: Correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 17 tests.

- [ ] **Step 5: Pasar la tinta de la plantilla desde el shell**

En `ClubStore.applyBranding`, pasar `PLANTILLAS[normalizarPlantilla(cfg.tenant.plantilla)].inkHex` como cuarto argumento de `applyTenantColors`.

- [ ] **Step 6: Verificar**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed** — el comportamiento visible no cambia todavía (las tres plantillas actuales son claras y usan la tinta por defecto).

- [ ] **Step 7: Commit**

```bash
git add src/app/core/branding/ src/app/features/landing/club.store.ts
git commit -m "feat(branding): la tinta legible contempla plantillas oscuras"
```

---

### Task 8: La plantilla entra en la clave del caché de marca

Bug latente: `branding-boot.ts` cachea las variables ya resueltas por slug. Si el club cambia de plantilla, un visitante que vuelve recibe un primer paint con la tinta de la plantilla vieja.

**Files:**
- Modify: `src/app/core/branding/branding-boot.ts`
- Create: `src/app/core/branding/branding-boot.spec.ts`
- Modify: `src/app/core/branding/branding.service.ts`, `src/app/app.config.ts` (los dos usan la clave)

**Interfaces:**
- Produces: `brandingCacheKey(slug: string, plantilla: string): string` — un parámetro más, obligatorio.

- [ ] **Step 1: Escribir el test que falla**

`src/app/core/branding/branding-boot.spec.ts`:

```ts
import { brandingCacheKey, guardarMarcaCacheada, leerMarcaCacheada } from './branding-boot';

describe('caché de marca', () => {
  beforeEach(() => localStorage.clear());

  it('separa la marca por plantilla', () => {
    expect(brandingCacheKey('demo', 'A')).not.toBe(brandingCacheKey('demo', 'B'));
  });

  it('no devuelve la marca de otra plantilla del mismo club', () => {
    guardarMarcaCacheada('demo', 'A', { vars: { '--court': '#111' }, logoUrl: null });
    expect(leerMarcaCacheada('demo', 'B')).toBeNull();
    expect(leerMarcaCacheada('demo', 'A')?.vars['--court']).toBe('#111');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
npm test
```

Esperado: FAIL — `brandingCacheKey` recibe 1 argumento.

- [ ] **Step 3: Implementar**

```ts
/** Una clave por club Y plantilla: si el club cambia de plantilla, la marca vieja no se repinta
 *  (la tinta legible depende del esquema claro/oscuro del shell). */
export const brandingCacheKey = (slug: string, plantilla: string) =>
  `padel_branding_${slug}_${plantilla}`;
```

Propagar el parámetro a `leerMarcaCacheada`, `guardarMarcaCacheada` y `aplicarMarcaCacheada`. En `branding.service.ts` y `app.config.ts`, el valor sale de la plantilla conocida (en el arranque del panel, de la marca cacheada previa o `'A'`).

> Las claves viejas (`padel_branding_<slug>`) quedan huérfanas en el localStorage de los visitantes. Es aceptable: son unos pocos bytes y el navegador las descarta con el tiempo. **No** escribas código de migración para esto.

- [ ] **Step 4: Correr y verificar que pasa**

```bash
npm test
```

Esperado: PASS, 19 tests.

- [ ] **Step 5: Verificar y commitear**

```bash
npm run build
npx playwright test e2e
git add src/app/core/branding/ src/app/app.config.ts
git commit -m "fix(branding): la plantilla forma parte de la clave del caché de marca"
```

---

### Task 9: El back acepta `D` y `E` (repo `padelBack`)

**Files:**
- Modify: `src/main/java/org/example/padelback/modules/reservas/presentation/dto/MarcaRequest.java:14`
- Modify: `src/main/java/org/example/padelback/modules/tenant/application/TenantProvisioningService.java:211-216`
- Modify: `src/main/java/org/example/padelback/modules/tenant/application/TenantAdminService.java:137-140`
- Modify: `src/main/java/org/example/padelback/modules/tenant/infrastructure/persistence/entity/TenantJpaEntity.java:52`
- Test: `src/test/java/org/example/padelback/modules/tenant/PlatformIT.java` — **ya cubre plantilla**, incluido que el owner la cambie por el endpoint de marca. Los tests nuevos van ahí; no crear una clase nueva.

- [ ] **Step 1: Escribir el test que falla**

Los ITs de este repo **no usan MockMvc**: extienden `IntegrationTestBase`, que levanta el backend real en `RANDOM_PORT` contra un MySQL de Testcontainers y expone `exchange(HttpMethod, url, body, headers, Class)`, `ownerHeaders()` y `publicHeaders()`. El cliente **no lanza** ante 4xx/5xx: el test lee el status.

Agregar en `PlatformIT`:

```java
@Test
@SuppressWarnings("unchecked")
void ownerPuedeElegirLasPlantillasNuevas() {
    Map<String, Object> body = new HashMap<>();
    body.put("colorPrimario", "#0a8a99");
    body.put("plantilla", "E");
    ResponseEntity<Map> resp = exchange(HttpMethod.PUT, "/api/v1/agenda/marca", body, ownerHeaders(), Map.class);
    assertThat(resp.getStatusCode().value()).isEqualTo(200);
    assertThat(resp.getBody().get("plantilla")).isEqualTo("E");
}

@Test
void rechazaUnaPlantillaInexistente() {
    Map<String, Object> body = new HashMap<>();
    body.put("colorPrimario", "#0a8a99");
    body.put("plantilla", "F");
    ResponseEntity<String> resp = exchange(HttpMethod.PUT, "/api/v1/agenda/marca", body, ownerHeaders(), String.class);
    assertThat(resp.getStatusCode().value()).isEqualTo(400);
}
```

> Dejá la plantilla del tenant `demo` como estaba al final del primer test si algún test posterior de la clase depende de ella — revisá el orden de la clase antes de commitear.

- [ ] **Step 2: Correr y verificar que falla**

Los `*IT` **sólo corren con `verify`**, no con `test`:

```bash
./mvnw verify -Dit.test=PlatformIT
```

Esperado: FAIL en `ownerPuedeElegirLasPlantillasNuevas` — 400 por el `@Pattern` actual.

- [ ] **Step 3: Ampliar el rango en los tres lugares**

```java
// MarcaRequest.java
@Pattern(regexp = "^[A-Ea-e]$", message = "La plantilla debe ser A, B, C, D o E")
String plantilla,
```

```java
// TenantProvisioningService.java
return up.matches("[ABCDE]") ? up : DEFAULT_PLANTILLA;
```

```java
// TenantAdminService.java — parsePlantilla
if (!s.matches("^[A-Ea-e]$")) {
    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Plantilla inválida (A/B/C/D/E).");
}
```

Actualizar el comentario de `TenantJpaEntity.plantilla:52` para nombrar las cinco. **No** hace falta migración: la columna es `VARCHAR(1)`.

- [ ] **Step 4: Correr y verificar que pasa**

```bash
./mvnw verify
```

Esperado: verde, con los 2 tests nuevos sumados a los que ya había.

- [ ] **Step 5: Commit**

```bash
git add src/main src/test
git commit -m "feat(tenant): acepta las plantillas D y E"
```

---

### Task 10: Contrato de tokens `--flow-*` (repo `padelFront`)

Última pieza de la base, y la costura que el Plan 2 necesita: el flujo deja de tener valores visuales propios y pasa a leerlos del shell. **Los valores no cambian** — cada shell declara exactamente lo que el flujo tiene hardcodeado hoy. Es un cambio de indirección, no de diseño.

**Files:**
- Create: `src/app/features/landing/shells/a-afiche/_tokens.scss`
- Create: `src/app/features/landing/shells/b-nocturna/_tokens.scss`
- Create: `src/app/features/landing/shells/c-tarjeta/_tokens.scss`
- Modify: `src/app/features/landing/booking/booking-flow.scss`
- Modify: los tres `shell.scss` (importan su `_tokens.scss`)

**Interfaces:**
- Produces: el contrato que consume `booking-flow.scss` y que **todo shell nuevo debe declarar**:
  ```scss
  --flow-surface   // fondo del contenedor de los pasos
  --flow-border    // borde del contenedor y de las tarjetas
  --flow-radius    // radio del contenedor
  --flow-shadow    // sombra del contenedor
  --flow-gap       // separación entre pasos
  --flow-backdrop  // filtro de fondo (o `none`)
  ```

- [ ] **Step 1: Tokenizar el flujo con fallback al valor de hoy**

En `booking-flow.scss`, reemplazar los valores visuales del contenedor por tokens **con el valor actual como fallback**, de modo que si un shell se olvida de declarar uno, se ve igual que hoy:

```scss
.booking-flow {
  background: var(--flow-surface, var(--surface));
  border-radius: var(--flow-radius, var(--r-lg));
  box-shadow: var(--flow-shadow, none);
  -webkit-backdrop-filter: var(--flow-backdrop, none);
  backdrop-filter: var(--flow-backdrop, none);
}
.booking-flow .step { gap: var(--flow-gap, 18px); border-color: var(--flow-border, var(--line)); }
```

> Los valores de fallback de arriba son **ejemplos de la forma**, no los reales. Sacá los reales de lo que hoy tiene `booking-flow.scss` tras el Task 3 y usá esos exactos: el objetivo es que el CSS compilado dé el mismo resultado.

- [ ] **Step 2: Declarar los tokens en cada shell**

Ejemplo para B, que hoy pinta el flujo con `%b-glass` desde afuera (`landing.scss:731`):

```scss
// b-nocturna/_tokens.scss
.tpl-b {
  --flow-surface: #{color-mix(in srgb, var(--surface) 58%, transparent)};
  --flow-border: #{color-mix(in srgb, #fff 60%, transparent)};
  --flow-radius: 28px;
  --flow-shadow: 0 20px 50px -28px #{color-mix(in srgb, var(--court) 45%, rgba(15, 23, 42, 0.45))},
                 inset 0 1px 0 rgba(255, 255, 255, 0.6);
  --flow-backdrop: blur(22px) saturate(1.6);
}
```

Con esto, la regla `.tpl-b .booking-flow { @extend %b-glass; }` **se borra**, y con ella la razón por la que el flujo necesitaba `ViewEncapsulation.None` en el Task 3.

- [ ] **Step 3: Sacar la encapsulación abierta del flujo**

Si tras el Step 2 no queda ninguna regla externa apuntando al interior del flujo, quitar `encapsulation: ViewEncapsulation.None` de `booking-flow.ts`. Si queda alguna (ej. `.tpl-c .flow-head .mono { display: none }`), convertirla también a token (`--flow-marca-display`) antes de sacar la encapsulación.

- [ ] **Step 4: Verificar que el pixel no se movió**

```bash
npm run build
npx playwright test e2e
```

Esperado: **20 passed**. Y comparación visual de las tres plantillas en 390×844 y 1440×900 — este task es 100% indirección, así que **cualquier** diferencia visible es un error de transcripción de un valor.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/landing/
git commit -m "refactor(landing): el flujo de reserva se pinta con tokens del shell"
```

---

## Cierre del Plan 1

Con los 10 tasks hechos: el visitante ve **exactamente lo mismo que antes**, pero la landing quedó partida en piezas con responsabilidad única, el catálogo de plantillas es dato, la tipografía viaja por plantilla, el cálculo de tinta soporta shells oscuros y el back acepta los cinco códigos.

**Qué NO cambió y es correcto que no haya cambiado:** ninguna plantilla se ve distinta, la galería del panel sigue siendo un `<select>` y marketing sigue sin la sección de personalización. Eso es el Plan 2 y el Plan 3.

**Antes de empezar el Plan 2**, verificar que se cumple todo esto:
- `npx playwright test e2e` → 20 passed, **con los specs sin modificar**.
- `npm test` → 19 passed.
- `./mvnw verify` en `padelBack` → verde, con los 2 tests nuevos de `PlatformIT`.
- Ningún shell pinta el flujo desde afuera: `grep -rn "booking-flow" src/app/features/landing/shells/` no devuelve reglas de estilo.
- `npm run build` verde.
- Comparación visual de las tres plantillas en 390×844 y 1440×900 contra capturas previas al Task 1.
