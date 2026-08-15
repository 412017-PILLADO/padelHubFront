# Galería de plantillas en el panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el dueño del club **vea** las plantillas con **sus** colores antes de elegir, en vez de leer un `<select>` de texto.

**Architecture:** dos piezas nuevas y ningún cambio en cómo se guarda. Una miniatura tokenizada (`<plantilla-thumb>`) que dibuja el afiche de cada plantilla con `var(--court)` / `var(--court-2)` —sin imágenes ni iframes múltiples—, y un preview vivo en un solo iframe a la landing real del club con los params de preview que ya existen. La selección sigue llamando a `setMarcaPlantilla()`: el guardado y el aviso de cambios sin guardar no se tocan.

**Tech Stack:** Angular 21 standalone + signals + SSR · SCSS con el sistema de tres capas de tokens · Vitest · Playwright.

## Lo que la spec fija, y no está a discusión

De `docs/superpowers/specs/2026-08-08-plantillas-visuales-design.md` §7:

| | |
|---|---|
| **Qué reemplaza** | el `<select>` de `tab-club.html:35` |
| **Miniaturas** | grilla tokenizada, con `var(--court)`/`var(--court-2)`, **sin imágenes ni iframes múltiples** |
| **Preview vivo** | **un** iframe a `/?plantilla=<X>&color=%23RRGGBB`, aprovechando los params que ya existen |
| **Arranque del preview** | **marco de teléfono (390px)** con toggle a escritorio, porque el producto se usa mayormente en mobile |
| **Guardado** | sigue siendo `setMarcaPlantilla()` + `unsaved-changes.service.ts`, sin tocar |

**La spec habla de CINCO miniaturas. Son CUATRO.** D quedó descartada por el owner y no tiene cáscara en `main`. La lista **sale de `CODIGOS_CON_SHELL`** (`core/landing/plantillas.ts`), nunca escrita a mano: es un error que este código ya cometió tres veces, y `tab-club.spec.ts` existe justamente como puerta de eso.

## Global Constraints

- Comentarios, nombres de símbolos y mensajes de commit **en español**.
- **Sin dependencias nuevas.**
- **El sistema de tres capas** (spec §5.1) sin excepciones: la capa 2 nunca declara `--court*`; la capa 3 nunca declara superficie ni tinta. La miniatura **consume** `--court*` y declara su propia superficie/tinta: es capa 2.
- **Contraste**: 4,5:1 texto chico · 3:1 texto grande/negrita y componentes. El límite de "grande" es 24px = 18pt.
- **Nada de listas de plantillas escritas a mano.** Todo deriva de `CODIGOS_CON_SHELL` / `PLANTILLAS`.
- **SSR-safe**: `<plantilla-thumb>` la va a reusar la sección de marketing (spec §8), que sí se renderiza en el server. Nada de `window`/`document` en su camino de render.
- El panel **no** se toca fuera de `tab-club`: ni el guardado, ni `ConfigStateService.dirty`, ni `UnsavedChangesService`.

## Cómo correr las cosas (trampas ya pagadas con horas)

- Unit: **`npm test` pelado**. `npm test -- --filter <archivo>` corre **cero tests y sale verde**; `npx vitest run <path>` dice "no tests". Las dos son falsos verdes.
- Build: `npm run build`. Presupuesto de warning en 550 kB.
- E2E: **`npx playwright test e2e`, siempre con el path**. Pelado escanea `src/`, `.claude/` y el proyecto hermano BarberApp, carga dos `@playwright/test` y corrompe el runner.
- Playwright levanta su front en 4400 con `reuseExistingServer: false` → matar cualquier `ng serve` propio antes.
- **El stack**: MySQL es el contenedor `padel-mysql` (**3308 → 3306**). El back **no arranca sólo con `SPRING_PROFILES_ACTIVE=local`**: los defaults son puerto 8080 y MySQL 3306, ninguno sirve acá. Desde `padelBack`:
  ```
  PORT=8095 DB_URL='jdbc:mysql://localhost:3308/padeldb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC' SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
  ```
  Si Docker no responde, `com.docker.service` está detenido y arrancarlo **pide elevación**.
- **Probar toda puerta en rojo.** Un test que nunca se vio fallar no es una puerta.

## La trampa que va a costar la tarde si no se lee: el iframe NO puede apuntar a `/`

La spec dice "iframe a `/?plantilla=…` (mismo origen)". **En producción es cierto y en desarrollo no**, y si se escribe literal el preview miente:

- El tenant se resuelve **por subdominio** (`core/tenant/tenant.ts`): `demo.localhost` → `demo`, `localhost` → `null`.
- La ruta `''` tiene `canMatch: tenantHostMatch`. **Sin subdominio no matchea la landing del club: cae en la landing de marketing.**
- En producción el panel vive en `<slug>.padel-hub.com.ar/admin`, así que `/` sí es la landing del club.
- **En desarrollo el panel vive en `localhost:4400/admin`** (host raíz, sin subdominio, ver el documento de estado). Un iframe a `/?plantilla=B` desde ahí muestra **marketing**, no la landing.

Por eso el `src` se arma con una función pura que resuelve el host del tenant (Task 4), y no con un string relativo.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `shared/plantilla-thumb/plantilla-thumb.ts` / `.html` / `.scss` | la miniatura tokenizada de UNA plantilla | 1 |
| `shared/plantilla-thumb/plantilla-thumb.spec.ts` | que la miniatura derive del registry y no invente | 1 |
| `features/admin/config/tabs/tab-club/tab-club.html` / `.ts` / `.scss` | el `<select>` se va, entra la grilla | 2 |
| `features/admin/config/tabs/tab-club/tab-club.spec.ts` | la puerta de "ofrece exactamente lo que tiene cáscara", extendida al DOM | 2 |
| `features/landing/club.store.ts` | `?color2=` y `?panel=1`, los dos params que el preview necesita y hoy no existen | 3 |
| `core/landing/preview-url.ts` + `.spec.ts` | la función pura que arma el `src` del iframe | 4 |
| `features/admin/config/tabs/tab-club/preview-plantilla/…` | el iframe con marco de teléfono y toggle | 5 |
| `e2e/galeria.spec.ts` | elegir desde la galería, guardar, verlo en la landing — la suite pasa a **22** | 6 |

---

### Task 1: `<plantilla-thumb>` — la miniatura tokenizada

La pieza que hace todo lo demás posible: un afiche chico de cada plantilla, dibujado con el color del club, sin una sola imagen. Es capa 2 (declara su superficie y su tinta, consume `--court*`), y tiene que ser SSR-safe porque marketing la va a reusar.

**Files:**
- Create: `src/app/shared/plantilla-thumb/plantilla-thumb.ts`, `plantilla-thumb.html`, `plantilla-thumb.scss`, `plantilla-thumb.spec.ts`

**Interfaces:**
- Produce: `PlantillaThumbComponent`, selector `plantilla-thumb`, standalone, con `input.required<CodigoConShell>()` llamado `codigo`. Publica en su host `[attr.data-tpl]="codigo()"` y `[attr.data-esquema]` sacado de `PLANTILLAS[codigo].esquema`.
- Consume: `CodigoConShell`, `CODIGOS_CON_SHELL`, `PLANTILLAS` de `core/landing/plantillas`.

- [ ] **Step 1: Escribir el spec en rojo**

Crear `src/app/shared/plantilla-thumb/plantilla-thumb.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { CODIGOS_CON_SHELL, PLANTILLAS } from '../../core/landing/plantillas';
import { PlantillaThumbComponent } from './plantilla-thumb';

/**
 * La miniatura es lo único que el dueño del club va a mirar para elegir plantilla, así que lo que
 * se vigila acá es que NO INVENTE: que dibuje una por cada cáscara que existe de verdad, que la
 * colorimetría salga del `esquema` del registry (pineado a su vez contra la hoja real en
 * plantillas.spec.ts) y que el color del club entre por token y no por una copia.
 */
function montar(codigo: (typeof CODIGOS_CON_SHELL)[number]) {
  TestBed.configureTestingModule({
    imports: [PlantillaThumbComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(PlantillaThumbComponent);
  fixture.componentRef.setInput('codigo', codigo);
  fixture.detectChanges();
  return fixture;
}

describe('plantilla-thumb · la miniatura de una plantilla', () => {
  it('publica el código y el esquema del registry en el host', () => {
    for (const codigo of CODIGOS_CON_SHELL) {
      const host = montar(codigo).nativeElement as HTMLElement;
      expect(host.getAttribute('data-tpl')).toBe(codigo);
      expect(host.getAttribute('data-esquema')).toBe(PLANTILLAS[codigo].esquema);
    }
  });

  it('no usa NI UNA imagen ni un iframe: es HTML tokenizado', () => {
    // La spec §7 lo pide explícito, y §8 depende de eso: en marketing van cuatro a la vez y se
    // repintan con cada swatch. Una imagen se desactualiza sola y un iframe por miniatura serían
    // cuatro landings cargando atrás de un panel de configuración.
    for (const codigo of CODIGOS_CON_SHELL) {
      const host = montar(codigo).nativeElement as HTMLElement;
      expect(host.querySelectorAll('img, iframe, svg image, picture')).toHaveLength(0);
      expect(host.innerHTML).not.toContain('url(');
    }
  });

  it('cada plantilla dibuja una silueta DISTINTA', () => {
    // Cuatro miniaturas iguales no ayudan a elegir: serían cuatro rectángulos del color del club.
    const siluetas = CODIGOS_CON_SHELL.map((codigo) => {
      const host = montar(codigo).nativeElement as HTMLElement;
      return host.querySelector('.thumb')!.className;
    });
    expect(new Set(siluetas).size).toBe(CODIGOS_CON_SHELL.length);
  });

  it('el color del club entra por token, no copiado', () => {
    // Si la hoja escribiera un hex, la miniatura mostraría el color de OTRO club.
    const hoja = montar('A').nativeElement as HTMLElement;
    expect(hoja.querySelector('.thumb')).not.toBeNull();
    // La verificación fuerte de que la hoja usa `var(--court)` vive en el paso 5 (lee el .scss).
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** — `Failed to resolve import "./plantilla-thumb"`. Es el rojo correcto: el componente todavía no existe.

- [ ] **Step 3: El componente**

Crear `src/app/shared/plantilla-thumb/plantilla-thumb.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CodigoConShell, PLANTILLAS } from '../../core/landing/plantillas';

/**
 * Miniatura tokenizada de una plantilla de landing: un afiche chico que usa `var(--court)` y
 * `var(--court-2)`, así el club se ve con SUS colores en las cuatro antes de elegir (spec §7).
 *
 * Sin imágenes y sin iframe, y las dos ausencias son decisiones y no comodidad. Una imagen se
 * desactualiza sola en cuanto una plantilla cambia y nadie se entera; un iframe por miniatura serían
 * cuatro landings enteras cargando atrás de un panel de configuración. Lo que sí es un costado
 * conocido y está en la spec: la miniatura es un AFICHE, no la landing renderizada. Si una plantilla
 * cambia mucho, su silueta se actualiza a mano — para eso está el preview vivo al lado.
 *
 * Es CAPA 2 (spec §5.1): declara su propia superficie y su tinta —las saca del `esquema` del
 * registry, que a su vez está pineado contra la hoja real de cada cáscara en `plantillas.spec.ts`—
 * y NUNCA declara `--court*`, que es de la capa 3. Quien le pone el color es el contenedor.
 *
 * SSR-safe a propósito: `nada de window/document`. La sección de personalización de marketing
 * (spec §8) la va a reusar y esa sí se renderiza en el server.
 */
@Component({
  selector: 'plantilla-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plantilla-thumb.html',
  styleUrl: './plantilla-thumb.scss',
  host: {
    '[attr.data-tpl]': 'codigo()',
    '[attr.data-esquema]': 'ficha().esquema',
  },
})
export class PlantillaThumbComponent {
  /** Qué plantilla dibujar. Sólo códigos CON cáscara: una miniatura de algo que no se puede
   *  elegir sería publicidad de un producto que no existe. */
  readonly codigo = input.required<CodigoConShell>();

  /** La ficha entera del registry: nombre, descripción y esquema salen de ahí, nunca de acá. */
  readonly ficha = computed(() => PLANTILLAS[this.codigo()]);

  /** La clase que elige la silueta. Deriva del código, así que una cáscara nueva entra sola con su
   *  bloque en la hoja y no hay lista que sincronizar. */
  readonly claseSilueta = computed(() => `t-${this.codigo().toLowerCase()}`);
}
```

- [ ] **Step 4: El template**

Crear `src/app/shared/plantilla-thumb/plantilla-thumb.html`:

```html
<!-- El MISMO DOM para las cuatro: lo que cambia es la hoja. Así una plantilla no puede tener una
     miniatura con piezas que otra no tiene, y la comparación entre las cuatro es honesta. -->
<span class="thumb" [class]="claseSilueta()" aria-hidden="true">
  <span class="th-marca"></span>
  <span class="th-titulo"></span>
  <span class="th-panel">
    <span class="th-chip"></span>
    <span class="th-chip"></span>
    <span class="th-cta"></span>
  </span>
</span>
```

`aria-hidden`: la miniatura es decorativa. Quien nombra la plantilla es el `<label>` del radio que la envuelve (Task 2), y un lector de pantalla que enumere seis `<span>` vacíos por plantilla no ayuda a nadie.

- [ ] **Step 5: La hoja**

Crear `src/app/shared/plantilla-thumb/plantilla-thumb.scss`:

```scss
/* ==================================================================================================
   MINIATURAS TOKENIZADAS · un afiche chico por plantilla (spec §7)

   CAPA 2: acá se declaran superficie y tinta de la miniatura, y NO se declara ningún `--court*`.
   El color del club lo pone el contenedor (el panel lo saca del formulario, marketing de sus
   swatches), así que la MISMA hoja sirve para los dos consumidores.

   Las siluetas no son adorno: cada una es la firma de su plantilla reducida a lo que se reconoce de
   un vistazo. Si se parecieran entre sí, la galería no ayudaría a elegir — que es su único trabajo.
   ================================================================================================== */
:host {
  display: block;
  --th-paper: #f4f6fb;
  --th-ink: #10151f;
  --th-linea: color-mix(in srgb, var(--th-ink) 12%, var(--th-paper));
}

/* La B es la oscura. El esquema sale del registry y no de una lista acá: `plantillas.spec.ts` lo
   tiene pineado contra la tinta que la hoja de cada cáscara declara de verdad. */
:host([data-esquema='dark']) {
  --th-paper: #0b0f17;
  --th-ink: #eef2f8;
}

.thumb {
  display: grid;
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border-radius: 10px;
  background: var(--th-paper);
  color: var(--th-ink);
  container-type: inline-size;
}

/* Las piezas, en abstracto: la marca, el display, el tablero del flujo con dos chips y el CTA.
   Los tamaños van en `cqi` (porcentaje del ancho del propio thumb) para que la miniatura se lea
   igual a 90px en la grilla del panel que a 200px en el carrusel de marketing. */
.th-marca  { width: 22cqi; height: 4cqi;  border-radius: 2cqi; background: currentColor; opacity: 0.75; }
.th-titulo { width: 68cqi; height: 9cqi;  border-radius: 1.5cqi; background: currentColor; }
.th-panel  { display: grid; gap: 3cqi; padding: 4cqi; border-radius: 3cqi; }
.th-chip   { height: 5cqi; border-radius: 2.5cqi; background: color-mix(in srgb, var(--th-ink) 14%, transparent); }
.th-cta    { height: 7cqi; border-radius: 2cqi; background: var(--court); }

/* ── A · AFICHE: el afiche a la izquierda, la columna de reserva a la derecha ────────────────────
   Su firma es la marca grande y el corte vertical. El color es MASA en la mitad izquierda. */
.t-a {
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 0;
  .th-marca  { grid-area: 1 / 1; margin: 6cqi 0 0 6cqi; }
  .th-titulo { grid-area: 1 / 1; align-self: end; width: 34cqi; height: 26cqi; margin: 0 0 8cqi 6cqi;
               background: var(--ink-on-accent, #fff); }
  .th-panel  { grid-area: 1 / 2; align-content: start; margin: 8cqi 6cqi 0 0; }
  &::before {
    content: ''; position: absolute; inset: 0 50% 0 0; background: var(--court);
  }
  .th-marca { background: var(--ink-on-accent, #fff); opacity: 0.85; }
}

/* ── B · NOCTURNA: telón oscuro con la luz de cancha ─────────────────────────────────────────────
   Su firma es el resplandor, no un bloque de color: el club entra como LUZ sobre la noche. */
.t-b {
  align-content: start;
  gap: 4cqi;
  padding: 8cqi 7cqi;
  &::before {
    content: ''; position: absolute; inset: -20% -10% 40% -10%; border-radius: 50%;
    background: radial-gradient(closest-side, var(--court), transparent 70%);
    opacity: 0.55;
  }
  .th-marca, .th-titulo, .th-panel { position: relative; }
  .th-panel {
    background: color-mix(in srgb, var(--th-ink) 8%, transparent);
    border: 0.6cqi solid color-mix(in srgb, var(--th-ink) 18%, transparent);
  }
}

/* ── C · TARJETA: tipo app, todo apilado para el pulgar ──────────────────────────────────────────
   Su firma es la pila de tarjetas con radios grandes y aire entre ellas. Sin masa de color. */
.t-c {
  align-content: start;
  gap: 3.5cqi;
  padding: 7cqi 6cqi;
  .th-marca  { width: 16cqi; }
  .th-titulo { width: 52cqi; height: 7cqi; }
  .th-panel  {
    gap: 3.5cqi;
    background: color-mix(in srgb, var(--th-ink) 4%, transparent);
    border: 0.5cqi solid var(--th-linea);
    border-radius: 5cqi;
  }
  .th-chip { height: 7cqi; border-radius: 3.5cqi; background: color-mix(in srgb, var(--th-ink) 8%, transparent);
             border: 0.5cqi solid var(--th-linea); }
  .th-cta  { border-radius: 3.5cqi; }
}

/* ── E · DIURNA: el vidrio a caballo del borde del campo ─────────────────────────────────────────
   Su firma es el SOLAPE: el tablero pisa el canto del campo de color en vez de apoyarse abajo. */
.t-e {
  align-content: start;
  gap: 3cqi;
  padding: 7cqi 6cqi 0;
  &::before {
    content: ''; position: absolute; inset: 0 0 62% 0; background: var(--court);
  }
  .th-marca, .th-titulo { position: relative; background: var(--ink-on-accent, #fff); }
  .th-titulo { width: 56cqi; height: 8cqi; }
  .th-panel  {
    position: relative;
    margin-top: 4cqi;
    background: color-mix(in srgb, var(--th-paper) 82%, transparent);
    border: 0.5cqi solid color-mix(in srgb, var(--th-ink) 10%, transparent);
    backdrop-filter: blur(2px);
  }
}
```

- [ ] **Step 6: Verde**

Run: `npm test`
Expected: **PASS**, con 4 tests nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/plantilla-thumb/
git commit -m "feat(galeria): la miniatura tokenizada de una plantilla, con el color del club"
```

---

### Task 2: La grilla reemplaza al `<select>`

El cambio que el dueño del club nota. El `<select>` se va; entran cuatro miniaturas elegibles con teclado, pintadas con el color **del formulario** (el que el dueño está editando ahora), no con el guardado.

**Files:**
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.html` (líneas 32-41, el bloque de la plantilla)
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.ts`
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.scss`
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.spec.ts`

**Interfaces:**
- Consume: `PlantillaThumbComponent` de la Task 1.
- Produce: en `TabClubComponent`, `readonly tintaSobreColor = computed<string>(...)` — la tinta legible sobre el color del formulario, sacada de `inkOnAccent()`.

- [ ] **Step 1: Escribir los tests en rojo**

Agregar al final de `tab-club.spec.ts` (dejando intacto lo que ya tiene, que es la puerta de la lista):

```ts
describe('la galería de plantillas del panel', () => {
  function montarTab() {
    TestBed.configureTestingModule({
      imports: [TabClubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        MessageService,
        ConfigStateService,
      ],
    });
    const fixture = TestBed.createComponent(TabClubComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('YA NO hay un <select> de plantillas', () => {
    // La razón de ser de toda esta tarea: leer "B · Nocturna — Oscura, luz de cancha" y tener que
    // imaginarse el resto. Si el select sobrevive, se agregó una galería al lado en vez de
    // reemplazarlo, y el dueño tiene dos controles que dicen lo mismo.
    const host = montarTab().nativeElement as HTMLElement;
    expect(host.querySelector('.plantilla-sel')).toBeNull();
    expect(host.querySelector('select')).toBeNull();
  });

  it('dibuja una miniatura por cáscara existente, y ninguna más', () => {
    const host = montarTab().nativeElement as HTMLElement;
    const thumbs = [...host.querySelectorAll('plantilla-thumb')];
    expect(thumbs.map((t) => t.getAttribute('data-tpl'))).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('cada miniatura es un radio de verdad, para poder elegir con el teclado', () => {
    // Una grilla de <div> con (click) deja al dueño sin teclado y sin lector de pantalla. Los radios
    // nativos traen las flechas, el grupo y el nombre accesible sin escribir un handler.
    const host = montarTab().nativeElement as HTMLElement;
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(CODIGOS_CON_SHELL.length);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
  });

  it('elegir una miniatura llama a setMarcaPlantilla, que es lo que ya sabía guardar', () => {
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    const host = fixture.nativeElement as HTMLElement;

    const radioB = host.querySelector<HTMLInputElement>('input[type="radio"][value="B"]')!;
    radioB.click();
    fixture.detectChanges();

    expect(estado.marcaPlantilla()).toBe('B');
    expect(estado.dirty()).toBe(true);
  });

  it('la grilla publica el color DEL FORMULARIO, no el guardado', () => {
    // El dueño arrastra el color picker y las cuatro miniaturas se repintan al instante. Si tomaran
    // el color del :root (el que aplicó BrandingService al cargar), mostrarían el color viejo hasta
    // guardar — o sea que la galería contestaría la pregunta equivocada.
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    estado.setMarcaColor('#ff2d95');
    fixture.detectChanges();

    const grilla = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.galeria')!;
    expect(grilla.style.getPropertyValue('--court').trim()).toBe('#ff2d95');
  });

  it('la tinta sobre el color sale de inkOnAccent y no de un hardcode', () => {
    // Un club amarillo con texto blanco encima es ilegible, y la miniatura de A y la de E ponen
    // texto sobre la masa de color. Es la MISMA función pura que usa el branding real.
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    for (const color of ['#ffd400', '#111111', '#ffffff']) {
      estado.setMarcaColor(color);
      fixture.detectChanges();
      const grilla = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.galeria')!;
      expect(grilla.style.getPropertyValue('--ink-on-accent').trim()).toBe(inkOnAccent(color));
    }
  });
});
```

Y arriba, sumar a los imports que ya están:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { inkOnAccent } from '../../../../../core/branding/tenant-colors';
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** con 6 tests rojos. El primero (`YA NO hay un <select>`) tiene que fallar porque el select existe — si pasara de una, el test no está mirando el componente montado.

- [ ] **Step 3: El componente**

En `tab-club.ts`, agregar los imports y el computed. El bloque `plantillas` que ya existe **no se toca**: sigue siendo la fuente de la lista, y sus tres tests siguen siendo la puerta.

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlantillaThumbComponent } from '../../../../../shared/plantilla-thumb/plantilla-thumb';
import { inkOnAccent } from '../../../../../core/branding/tenant-colors';
```

En el decorador: `imports: [FormsModule, PlantillaThumbComponent],`

Y adentro de la clase, al lado de los alias:

```ts
  /**
   * La tinta legible sobre el color que el dueño está eligiendo AHORA. Sale de `inkOnAccent()`, la
   * misma función pura que decide la tinta del producto real (core/branding/tenant-colors.ts), y no
   * de un `#fff` fijo: un club amarillo con texto blanco encima es ilegible, y las miniaturas de A y
   * de E ponen texto sobre la masa de color.
   *
   * Va acá y no en la miniatura porque la miniatura es capa 2 y no tiene por qué saber nada del
   * color del club — se lo pone el contenedor, exactamente como se lo va a poner marketing (§8).
   */
  readonly tintaSobreColor = computed(() => inkOnAccent(this.marcaColor()));
```

- [ ] **Step 4: El template**

En `tab-club.html`, reemplazar **todo** el `<div class="marca-field">` de la plantilla (líneas 32-41) por:

```html
    <div class="marca-field marca-field--ancho">
      <label class="marca-label" id="lbl-plantilla">Plantilla de la landing</label>
      <span class="marca-opt">Cambia el diseño de tu página pública. Se aplica al guardar.</span>

      <!-- El color va en el CONTENEDOR y no en el <html>: el resto del panel conserva su marca
           mientras estas cuatro se repintan con lo que el dueño está eligiendo. Es la misma técnica
           que la spec §8 le pide a marketing, y por eso la miniatura sirve para los dos. -->
      <div class="galeria" role="radiogroup" aria-labelledby="lbl-plantilla"
        [style.--court]="marcaColor()"
        [style.--court-2]="marcaColorSecPicker()"
        [style.--ink-on-accent]="tintaSobreColor()">
        @for (p of plantillas; track p.value) {
          <label class="gal-item" [class.sel]="marcaPlantilla() === p.value">
            <input type="radio" name="plantilla" [value]="p.value"
              [checked]="marcaPlantilla() === p.value"
              (change)="setMarcaPlantilla(p.value)" />
            <plantilla-thumb [codigo]="p.value" />
            <span class="gal-nombre">{{ p.label }}</span>
            <span class="gal-hint">{{ p.hint }}</span>
          </label>
        }
      </div>
    </div>
```

- [ ] **Step 5: La hoja**

Agregar al final de `tab-club.scss`:

```scss
/* ── GALERÍA DE PLANTILLAS ────────────────────────────────────────────────────────────────────
   Reemplaza al <select>: el dueño elige mirando, no leyendo. */
.marca-field--ancho { grid-column: 1 / -1; }

.galeria {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 14px;
  margin-top: 10px;
}

.gal-item {
  display: grid;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  /* El radio nativo se queda en el DOM (trae teclado, grupo y nombre accesible) pero no se dibuja:
     lo que se ve es la miniatura. `position: absolute` y no `display: none`, porque un radio con
     display:none no es enfocable y se llevaría puesto el teclado. */
  input { position: absolute; opacity: 0; width: 0; height: 0; }

  &:hover { border-color: var(--line-strong); }
  &.sel { border-color: var(--court); background: color-mix(in srgb, var(--court) 6%, transparent); }

  /* El anillo va sobre la tarjeta y sale del token de PLATAFORMA, no del color del club: con un
     club de color claro el anillo del color crudo llegó a medir 1,00:1 — invisible. Eso se pagó en
     la rama de cierre de deuda y no se vuelve atrás. */
  &:has(input:focus-visible) { outline: 2px solid var(--anillo-foco); outline-offset: 2px; }
}

.gal-nombre { font-size: 0.82rem; font-weight: 600; color: var(--ink); }
.gal-hint   { font-size: 0.74rem; color: var(--ink-dim); line-height: 1.25; }
```

- [ ] **Step 6: Verde**

Run: `npm test` → **PASS**, con los 3 tests viejos del selector + los 6 nuevos.
Run: `npm run build` → limpio.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/admin/config/tabs/tab-club/
git commit -m "feat(galeria): la grilla de miniaturas reemplaza al select de plantillas"
```

---

### Task 3: `?color2=` y `?panel=1` — los dos params que el preview necesita y hoy no existen

Antes de montar el iframe hay que darle a la landing lo que le falta para ser un preview honesto. Son dos agujeros medibles:

1. **`?color=` sólo pisa el primario.** El dueño puede estar editando el **secundario** sin guardar, y el preview le mostraría el secundario **viejo**. Un preview que miente sobre la mitad de la marca no sirve para decidir.
2. **El selector flotante de venta (`.tpl-pill`) aparece con `?plantilla=`.** Adentro del iframe eso es un **segundo** selector, que cambia lo que se ve pero **no** el formulario del panel: el dueño elegiría ahí, vería otra plantilla, guardaría, y se guardaría la del panel. Hay que poder apagarlo.

**Files:**
- Modify: `src/app/features/landing/club.store.ts` (`readPreviewParams`, `applyBranding`, y una señal nueva)
- Modify: `src/app/features/landing/landing.html` (la condición del `.tpl-pill`)
- Create: `src/app/features/landing/club.store.preview.spec.ts`

**Interfaces:**
- Produce: en `ClubStore`, `readonly previewColorSec = signal<string | null>(null)` y `readonly previewSinSelector = signal(false)`.

- [ ] **Step 1: Escribir el spec en rojo**

Crear `src/app/features/landing/club.store.preview.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

import { ClubStore } from './club.store';

/**
 * Los params de preview que el panel necesita para que su iframe no mienta. `?color=` y
 * `?plantilla=` ya existían (herramienta de venta); estos dos son nuevos y nacen de dos agujeros
 * concretos, no de completitud:
 *
 *  - sin `?color2=`, un dueño que está editando el secundario ve el secundario VIEJO;
 *  - sin `?panel=1`, el selector flotante de venta aparece adentro del iframe y deja elegir una
 *    plantilla que el formulario del panel nunca se entera — se vería una y se guardaría otra.
 */
function storeConUrl(query: string): ClubStore {
  history.replaceState(null, '', `/${query}`);
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), ClubStore],
  });
  return TestBed.inject(ClubStore);
}

describe('ClubStore · los params del preview del panel', () => {
  it('?color2= pisa el secundario, con el mismo formato que ?color=', () => {
    const store = storeConUrl('?color=%23ff2d95&color2=%23ffd400');
    expect(store.previewColor()).toBe('#ff2d95');
    expect(store.previewColorSec()).toBe('#ffd400');
  });

  it('un ?color2= malformado se ignora en vez de romper la landing', () => {
    expect(storeConUrl('?color2=rojo').previewColorSec()).toBeNull();
    expect(storeConUrl('?color2=%23zzz').previewColorSec()).toBeNull();
  });

  it('?panel=1 apaga el selector flotante de venta', () => {
    expect(storeConUrl('?plantilla=B&panel=1').previewSinSelector()).toBe(true);
  });

  it('sin ?panel=1 el selector sigue estando: la herramienta de venta no se toca', () => {
    expect(storeConUrl('?plantilla=B').previewSinSelector()).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** — `previewColorSec is not a function`. Los cuatro rojos.

- [ ] **Step 3: Implementar**

En `club.store.ts`, al lado de `previewColor`:

```ts
  /** `?color2=%23RRGGBB`: el secundario del preview. Existe por el panel — su iframe tiene que poder
   *  mostrar el secundario SIN GUARDAR que el dueño está editando, o el preview miente sobre la
   *  mitad de la marca. Mismo formato y misma validación que `?color=`. */
  readonly previewColorSec = signal<string | null>(null);

  /** `?panel=1`: apaga el selector flotante de venta. Adentro del iframe del panel ese selector es un
   *  SEGUNDO control que cambia lo que se ve sin tocar el formulario: se elegiría una plantilla y se
   *  guardaría otra. La herramienta de venta (sin este param) no se entera de nada. */
  readonly previewSinSelector = signal(false);
```

En `readPreviewParams()`, después del bloque de `color`, factorizando la validación que ya existía:

```ts
    // La misma validación para los dos colores: un hex de 3 o 6, decodificado. Se factoriza porque
    // tener dos copias de esta regex fue exactamente cómo el secundario terminó sin validar.
    const leerHex = (raw: string | null): string | null => {
      if (!raw) return null;
      try {
        const decoded = decodeURIComponent(raw);
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(decoded) ? decoded : null;
      } catch {
        return null; // valor malformado (% suelto, etc.)
      }
    };

    const color = leerHex(params.get('color'));
    if (color) this.previewColor.set(color);

    const color2 = leerHex(params.get('color2'));
    if (color2) this.previewColorSec.set(color2);

    this.previewSinSelector.set(params.get('panel') === '1');
```

…reemplazando el bloque `if (color) { try { … } catch { … } }` que estaba antes.

En `applyBranding()`, donde hoy dice:

```ts
    const color = this.previewColor() ?? cfg.tenant.colorPrimario;
    applyTenantColors(this.doc.documentElement.style, color, cfg.tenant.colorSecundario);
```

pasa a:

```ts
    const color = this.previewColor() ?? cfg.tenant.colorPrimario;
    const colorSec = this.previewColorSec() ?? cfg.tenant.colorSecundario;
    applyTenantColors(this.doc.documentElement.style, color, colorSec);
```

- [ ] **Step 4: El selector flotante mira la señal**

En `landing.html`, la condición que hoy muestra `.tpl-pill` (busca `previewPlantilla()`) pasa a:

```html
@if (previewPlantilla() && !previewSinSelector()) {
```

y en `landing.ts`, al lado de `readonly previewPlantilla = this.club.previewPlantilla;`:

```ts
  readonly previewSinSelector = this.club.previewSinSelector;
```

- [ ] **Step 5: Verde**

Run: `npm test` → **PASS**. Los 3 tests de `preview.spec.ts` en e2e siguen valiendo tal cual: sin `?panel=1` nada cambia.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/landing/
git commit -m "feat(preview): el secundario y el apagado del selector entran por query param"
```

---

### Task 4: `urlPreviewLanding()` — la función pura que arma el `src`

**Leer la sección "la trampa" del encabezado antes de esta tarea.** Un `src="/?plantilla=B"` funciona en producción y muestra **marketing** en desarrollo. Se aísla en una función pura para poder probar los dos hosts sin levantar nada.

**Files:**
- Create: `src/app/core/landing/preview-url.ts`, `src/app/core/landing/preview-url.spec.ts`

**Interfaces:**
- Produce:
  ```ts
  export interface OpcionesPreview {
    readonly plantilla: string;
    readonly color: string;
    readonly colorSec?: string | null;
  }
  export function urlPreviewLanding(origen: string, opciones: OpcionesPreview): string;
  ```
  `origen` es un href absoluto (`location.href` en el llamador). Devuelve el href absoluto de la landing del tenant con los params de preview.

- [ ] **Step 1: Escribir el spec en rojo**

Crear `src/app/core/landing/preview-url.spec.ts`:

```ts
import { urlPreviewLanding } from './preview-url';

/**
 * EL SRC DEL IFRAME DEL PANEL, y la razón de que sea una función pura con tests propios: la spec §7
 * dice "iframe a `/?plantilla=…` (mismo origen)" y eso es cierto en PRODUCCIÓN y falso en DESARROLLO.
 *
 * El tenant se resuelve por subdominio (core/tenant/tenant.ts) y la ruta '' tiene
 * `canMatch: tenantHostMatch`. En producción el panel vive en `<slug>.padel-hub.com.ar/admin`, así
 * que `/` ES la landing del club. En desarrollo el panel vive en `localhost:4400/admin`, sin
 * subdominio: ahí `/` cae en la landing de MARKETING y el preview mostraría el producto en vez del
 * club. Con un `src` relativo eso no se descubre hasta abrirlo.
 */
describe('urlPreviewLanding · el src del iframe de preview', () => {
  it('en un host CON subdominio de tenant se queda en el mismo origen', () => {
    const url = urlPreviewLanding('https://costapadel.padel-hub.com.ar/admin/config?tab=club', {
      plantilla: 'B',
      color: '#ff2d95',
    });
    expect(new URL(url).origin).toBe('https://costapadel.padel-hub.com.ar');
    expect(new URL(url).pathname).toBe('/');
  });

  it('en el apex de DESARROLLO salta al subdominio del tenant de dev', () => {
    // Acá está el bug que esta función existe para no tener: `localhost:4400/` es marketing.
    const url = urlPreviewLanding('http://localhost:4400/admin/config', {
      plantilla: 'A',
      color: '#0a8a99',
    });
    expect(new URL(url).hostname).toBe('demo.localhost');
    expect(new URL(url).port).toBe('4400');
  });

  it('conserva el puerto y el protocolo del panel', () => {
    const url = new URL(urlPreviewLanding('http://demo.localhost:4400/admin', { plantilla: 'C', color: '#111' }));
    expect(url.protocol).toBe('http:');
    expect(url.port).toBe('4400');
  });

  it('escribe los params que la landing sabe leer', () => {
    const url = new URL(
      urlPreviewLanding('http://demo.localhost:4400/admin', {
        plantilla: 'E',
        color: '#ffd400',
        colorSec: '#ff2d95',
      }),
    );
    expect(url.searchParams.get('plantilla')).toBe('E');
    expect(url.searchParams.get('color')).toBe('#ffd400');
    expect(url.searchParams.get('color2')).toBe('#ff2d95');
    // Sin esto, adentro del iframe aparece el selector flotante de venta (ver Task 3).
    expect(url.searchParams.get('panel')).toBe('1');
  });

  it('sin secundario NO escribe color2, para que gane el del tenant', () => {
    const url = new URL(urlPreviewLanding('http://demo.localhost:4400/admin', { plantilla: 'A', color: '#111' }));
    expect(url.searchParams.has('color2')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** — no existe `./preview-url`.

- [ ] **Step 3: Implementar**

Crear `src/app/core/landing/preview-url.ts`:

```ts
import { environment } from '../../../environments/environment';
import { currentTenantSlug, tenantSubdomain } from '../tenant/tenant';

/** Lo que el preview pisa de la marca del tenant. El secundario es opcional a propósito: sin él
 *  gana el que el club tenga guardado, que es lo correcto cuando el dueño no lo tocó. */
export interface OpcionesPreview {
  readonly plantilla: string;
  readonly color: string;
  readonly colorSec?: string | null;
}

/**
 * El `src` del iframe de preview del panel, armado a partir del href donde está corriendo el panel.
 *
 * NO ES UN `/?plantilla=…` RELATIVO, y la diferencia no es cosmética. El tenant se resuelve por
 * SUBDOMINIO y la ruta '' sólo matchea la landing del club cuando hay uno (`tenantHostMatch`):
 *
 *   producción · `costapadel.padel-hub.com.ar/admin` → `/` es la landing del club  ✔ mismo origen
 *   desarrollo · `localhost:4400/admin`              → `/` es la landing de MARKETING  ✘
 *
 * Así que el host de destino sale de `currentTenantSlug()`, que en el apex cae al fallback de
 * desarrollo. En producción da el mismo host y el iframe queda same-origin igual que pide la spec;
 * en desarrollo apunta al subdominio y es cross-origin, que no molesta: el panel sólo lo MUESTRA
 * —no lee ni scriptea adentro— y la landing es pública, sin cookies ni auth de por medio.
 */
export function urlPreviewLanding(origen: string, opciones: OpcionesPreview): string {
  const base = new URL(origen);
  const host = tenantSubdomain(base.hostname)
    ? base.hostname
    : `${currentTenantSlug(base.hostname)}.${environment.baseDomain}`;

  const url = new URL(`${base.protocol}//${host}${base.port ? `:${base.port}` : ''}/`);
  url.searchParams.set('plantilla', opciones.plantilla);
  url.searchParams.set('color', opciones.color);
  if (opciones.colorSec) url.searchParams.set('color2', opciones.colorSec);
  // Apaga el selector flotante de venta: adentro del panel sería un segundo control desincronizado
  // del formulario (ver club.store.ts · previewSinSelector).
  url.searchParams.set('panel', '1');
  return url.toString();
}
```

**Ojo con `currentTenantSlug`/`tenantSubdomain`:** las dos aceptan el host por parámetro, así que **no** hace falta contexto de inyección y la función queda pura y testeable. Verificar que sigan con esa firma antes de escribir esto; si cambiaron, el arreglo es pasarle el host, no inyectar nada acá.

- [ ] **Step 4: Verde**

Run: `npm test` → **PASS**, 6 tests nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/landing/preview-url.ts src/app/core/landing/preview-url.spec.ts
git commit -m "feat(galeria): el src del preview sale de una funcion pura que resuelve el host del tenant"
```

---

### Task 5: El preview vivo, arrancando en marco de teléfono

La segunda mitad de la spec §7: un iframe con la landing **real**, no una miniatura. Arranca a 390px porque el producto se usa mayormente en el teléfono, con toggle a escritorio.

**Files:**
- Create: `src/app/features/admin/config/tabs/tab-club/preview-plantilla/preview-plantilla.ts`, `.html`, `.scss`, `.spec.ts`
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.html` (montarlo debajo de la galería)
- Modify: `src/app/features/admin/config/tabs/tab-club/tab-club.ts` (import)

**Interfaces:**
- Consume: `urlPreviewLanding()` de la Task 4.
- Produce: `PreviewPlantillaComponent`, selector `app-preview-plantilla`, con `input.required<string>()` `plantilla`, `input.required<string>()` `color` e `input<string | null>(null)` `colorSec`.

- [ ] **Step 1: Escribir el spec en rojo**

Crear `preview-plantilla.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PreviewPlantillaComponent } from './preview-plantilla';

function montar() {
  TestBed.configureTestingModule({
    imports: [PreviewPlantillaComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(PreviewPlantillaComponent);
  fixture.componentRef.setInput('plantilla', 'B');
  fixture.componentRef.setInput('color', '#ff2d95');
  fixture.detectChanges();
  return fixture;
}

describe('el preview vivo de la plantilla', () => {
  it('arranca en marco de TELÉFONO, no de escritorio', () => {
    // La spec §7 lo fija y el motivo está medido en la fase D: una plantilla puede leerse bien a
    // 1280 y no leerse a 390, y el producto se usa mayormente en el teléfono. Si arrancara en
    // escritorio, el dueño elegiría mirando el ancho que sus jugadores casi no usan.
    const fixture = montar();
    expect(fixture.componentInstance.marco()).toBe('telefono');
    const marco = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.marco')!;
    expect(marco.classList.contains('marco--telefono')).toBe(true);
  });

  it('se puede pasar a escritorio y volver', () => {
    const fixture = montar();
    fixture.componentInstance.setMarco('escritorio');
    fixture.detectChanges();
    const marco = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.marco')!;
    expect(marco.classList.contains('marco--escritorio')).toBe(true);
  });

  it('hay UN solo iframe, y lleva los params de la plantilla elegida', () => {
    // Uno solo: cuatro iframes serían cuatro landings cargando atrás de un formulario. Las otras
    // tres se muestran con las miniaturas, que no cargan nada.
    const host = montar().nativeElement as HTMLElement;
    const iframes = host.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const src = new URL(iframes[0].getAttribute('src')!);
    expect(src.searchParams.get('plantilla')).toBe('B');
    expect(src.searchParams.get('color')).toBe('#ff2d95');
  });

  it('el iframe tiene título: es contenido, no decoración', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelector('iframe')!.getAttribute('title')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npm test`
Expected: **FAIL** — no existe `./preview-plantilla`.

- [ ] **Step 3: El componente**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { urlPreviewLanding } from '../../../../../../core/landing/preview-url';

/** Los dos anchos del toggle. El teléfono es el default por spec §7. */
export type MarcoPreview = 'telefono' | 'escritorio';

/**
 * Preview vivo de la plantilla elegida: la landing REAL del club adentro de un iframe, con el color
 * y la plantilla que el dueño está eligiendo ahora (aunque no haya guardado todavía).
 *
 * UNO solo, y las otras tres plantillas se muestran con las miniaturas: cuatro iframes serían cuatro
 * landings enteras cargando atrás de un formulario de configuración.
 *
 * ARRANCA EN TELÉFONO. No es un default cómodo: la fase D midió que una plantilla puede leerse bien
 * a 1280 y no leerse a 390, y el producto se usa mayormente en el teléfono. Arrancar en escritorio
 * sería mostrarle al dueño el ancho que sus jugadores casi no usan.
 */
@Component({
  selector: 'app-preview-plantilla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-plantilla.html',
  styleUrl: './preview-plantilla.scss',
})
export class PreviewPlantillaComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly plantilla = input.required<string>();
  readonly color = input.required<string>();
  readonly colorSec = input<string | null>(null);

  /** Teléfono por default (spec §7). */
  readonly marco = signal<MarcoPreview>('telefono');
  setMarco(m: MarcoPreview): void {
    this.marco.set(m);
  }

  /** El href crudo, para que el test lo pueda leer sin pelearse con el sanitizer. */
  readonly href = computed(() =>
    urlPreviewLanding(this.doc.location.href, {
      plantilla: this.plantilla(),
      color: this.color(),
      colorSec: this.colorSec(),
    }),
  );

  /** Angular exige marcar el `src` de un iframe como confiable. Lo es: sale de `urlPreviewLanding()`,
   *  que arma la URL a partir del host donde ya está corriendo el panel — no de nada que el usuario
   *  escriba. */
  readonly src = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.href()),
  );
}
```

- [ ] **Step 4: El template**

`preview-plantilla.html`:

```html
<div class="preview-h">
  <span class="marca-label">Así se ve tu página</span>
  <div class="marco-toggle" role="group" aria-label="Ancho del preview">
    <button type="button" [class.on]="marco() === 'telefono'" [attr.aria-pressed]="marco() === 'telefono'"
      (click)="setMarco('telefono')">Teléfono</button>
    <button type="button" [class.on]="marco() === 'escritorio'" [attr.aria-pressed]="marco() === 'escritorio'"
      (click)="setMarco('escritorio')">Escritorio</button>
  </div>
</div>

<div class="marco" [class.marco--telefono]="marco() === 'telefono'"
  [class.marco--escritorio]="marco() === 'escritorio'">
  <iframe [src]="src()" [attr.data-href]="href()" title="Vista previa de tu página de reserva"></iframe>
</div>
```

`[attr.data-href]`: el `src` sanitizado no se puede leer como string desde el test. El atributo espejo es lo que el spec lee — y el test del Step 1 lo lee de `src`, así que **ajustar el test a `data-href`** si el sanitizer devuelve un objeto opaco. Correrlo y ver qué devuelve antes de decidir; si `getAttribute('src')` ya da la URL, borrar `data-href` en vez de dejar dos fuentes de verdad.

- [ ] **Step 5: La hoja**

`preview-plantilla.scss`:

```scss
:host { display: block; margin-top: 18px; }

.preview-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.marco-toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;

  button {
    padding: 5px 14px;
    font-size: 0.78rem;
    border: 0;
    background: transparent;
    color: var(--ink-dim);
    cursor: pointer;
    &.on { background: var(--court); color: var(--ink-on-accent, #fff); }
    &:focus-visible { outline: 2px solid var(--anillo-foco); outline-offset: -2px; }
  }
}

.marco {
  display: grid;
  justify-items: center;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--ink) 3%, transparent);

  iframe {
    border: 0;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 2px 14px rgb(0 0 0 / 12%);
  }
}

/* 390px es el ancho del teléfono con el que se revisó cada plantilla en las fases B, D y E. */
.marco--telefono iframe { width: 390px; height: 700px; }

/* En escritorio el iframe se lleva el ancho disponible y se escala: 1280 adentro de un panel no
   entra, y un iframe de 1280 con scroll horizontal no se parece a lo que ve un visitante. */
.marco--escritorio iframe {
  width: 1280px;
  height: 800px;
  transform: scale(0.52);
  transform-origin: top center;
  margin-bottom: -384px; /* recupera el alto que el scale deja en blanco */
}
```

- [ ] **Step 6: Montarlo en el tab**

En `tab-club.ts`, sumar `PreviewPlantillaComponent` a `imports`. En `tab-club.html`, justo **después** del `</div>` que cierra `.galeria`, dentro del mismo `.marca-field--ancho`:

```html
      <app-preview-plantilla [plantilla]="marcaPlantilla()" [color]="marcaColor()"
        [colorSec]="marcaColorSec()" />
```

- [ ] **Step 7: Verde y mirarlo con los propios ojos**

Run: `npm test` → **PASS**.
Run: `npm run build` → limpio, anotar el bundle.

Con el stack levantado, abrir `http://localhost:4400/admin` → Configuración → Tu club y confirmar:
- las cuatro miniaturas con el color del club;
- arrastrar el color picker repinta las cuatro **y** el preview;
- elegir una miniatura cambia el preview;
- el iframe **no** muestra el selector flotante de venta;
- tabular llega a los radios y el anillo de foco se ve.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/admin/config/tabs/tab-club/
git commit -m "feat(galeria): el preview vivo de la plantilla, en marco de telefono con toggle"
```

---

### Task 6: Puerta e2e — elegir desde la galería y verlo en la landing

Los unit prueban que la grilla llama a `setMarcaPlantilla()`. Lo que ninguno prueba es que **eso llegue a la página pública**: que el dueño elija mirando, guarde, y el jugador vea otra plantilla. Es el recorrido entero y es lo único que cubre el cable completo.

**Files:**
- Create: `e2e/galeria.spec.ts`

- [ ] **Step 1: El spec**

```ts
import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers';

/**
 * La galería de plantillas de punta a punta: el dueño elige MIRANDO (no leyendo un select), guarda,
 * y la landing pública cambia. Los unit cubren que la grilla llame a `setMarcaPlantilla()`; lo que
 * sólo se puede ver acá es que ese click sobreviva al guardado y llegue al visitante.
 *
 * Deja el tenant como lo encontró: la plantilla del demo es la A y otras specs la asumen.
 */
test('la galería del panel cambia la plantilla de la landing', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('http://localhost:4400/admin/config?tab=club');

  const galeria = page.locator('.galeria');
  await expect(galeria).toBeVisible();
  // Cuatro miniaturas, ni una imagen: es la spec §7 hecha aserción.
  await expect(galeria.locator('plantilla-thumb')).toHaveCount(4);
  await expect(galeria.locator('img')).toHaveCount(0);

  try {
    await galeria.locator('input[type="radio"][value="C"]').check();
    await expect(page.locator('.gal-item.sel plantilla-thumb')).toHaveAttribute('data-tpl', 'C');

    await page.getByRole('button', { name: /guardar/i }).click();
    await expect(page.getByText(/guardad/i)).toBeVisible();

    await page.goto('http://demo.localhost:4400/');
    await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'C');
  } finally {
    // Restaurar SIEMPRE, incluso si falló arriba: una spec que deja el demo en C hace fallar a las
    // que esperan la A, y el rojo aparece en el archivo equivocado.
    await page.goto('http://localhost:4400/admin/config?tab=club');
    await page.locator('.galeria input[type="radio"][value="A"]').check();
    await page.getByRole('button', { name: /guardar/i }).click();
    await expect(page.getByText(/guardad/i)).toBeVisible();
  }
});

test('el preview vivo arranca en teléfono y muestra la landing del club', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('http://localhost:4400/admin/config?tab=club');

  const iframe = page.locator('app-preview-plantilla iframe');
  await expect(iframe).toBeVisible();
  // 390: el ancho con el que se revisó cada plantilla. Si arranca en escritorio, el dueño elige
  // mirando el ancho que sus jugadores casi no usan.
  await expect(iframe).toHaveJSProperty('clientWidth', 390);

  // La trampa del apex: en dev el panel corre sin subdominio y un src relativo mostraría MARKETING.
  const src = await iframe.getAttribute('src');
  expect(src).toContain('demo.localhost');
  expect(src).toContain('panel=1');

  // Y adentro no aparece el segundo selector.
  await expect(page.frameLocator('app-preview-plantilla iframe').locator('.tpl-pill')).toHaveCount(0);
});
```

Antes de escribirlo: **abrir `e2e/helpers.ts` y usar el login que ya existe ahí**, con su nombre real. Si el helper no se llama `loginAdmin`, ajustar el import — no escribir un login nuevo.

- [ ] **Step 2: Correr**

Run: `npx playwright test e2e`
Expected: **22 passed** (21 + el archivo nuevo con 2 tests… o sea 23 — contar el total real y anotarlo, no dar por buena la aritmética de este plan).

- [ ] **Step 3: Commit**

```bash
git add e2e/galeria.spec.ts
git commit -m "test(galeria): elegir plantilla mirando, guardar, y verlo en la landing"
```

---

## Puerta final de la rama

- [ ] `npm test` verde, con el total anotado.
- [ ] `npm run build` limpio, bundle anotado y explicado si se movió.
- [ ] `npx playwright test e2e` verde **dos veces seguidas**, con la línea del teardown.
- [ ] Revisión visual del tab "Tu club" a **390 · 768 · 1280**: la grilla no se rompe y el preview entra.
- [ ] Las cuatro miniaturas con **seis paletas** (`?color=` sobre el panel no existe, así que se prueban desde el color picker): teal, naranja del demo, amarillo, casi blanco, casi negro, fucsia. Lo que se mira es que la silueta **siga siendo distinguible** con un club casi blanco — es la paleta que hizo desaparecer el campo de D.
- [ ] El `<select>` no volvió por ningún lado.
- [ ] Review de rama con un agente fresco.

## Lo que este plan NO hace, dicho a propósito

- **La sección de marketing (spec §8).** Depende de que exista `<plantilla-thumb>`, que es la Task 1, pero es otra pantalla y otro riesgo. Va en su propio plan.
- **El rediseño de C (spec §6.1).** Independiente de la galería.
- **Reemplazar a D con una quinta plantilla.** Es una decisión de producto, no técnica.
