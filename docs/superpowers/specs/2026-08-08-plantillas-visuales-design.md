# Plantillas visuales de la landing — Diseño

**Fecha:** 2026-08-08 · **Estado:** aprobado por el owner, listo para plan de implementación
**Repos afectados:** `padelFront` (mayoría) · `padelBack` (validación de plantilla)

---

## 1. Problema

Hoy existen 3 plantillas de landing (`tenants.plantilla` A/B/C, `V10__plantilla.sql`, default `'A'`) resueltas por un `@switch` en `features/landing/landing.html:365`. El owner las evaluó y el diagnóstico fue concreto:

1. **Se ven genéricas, a template.** Las tres comparten el mismo trío tipográfico (`Archivo` / `Hanken Grotesk` / `Space Mono`, cargado global en `index.html:49`), así que ninguna tiene personalidad propia.
2. **El color del club se nota poco.** A lo usa en masa; B lo diluye en gradientes al 16–42% (`landing.scss:683`) y C lo deja como acento chico. Dos clubes con colores muy distintos se ven casi iguales en B y C.

A eso se suma deuda estructural que hace caro corregirlo:

- **Todo en tres archivos:** `landing.ts` 35 KB (config + SEO + branding + estado de reserva + seña/MP + modales + los 3 shells), `landing.html` 30 KB, `landing.scss` 44 KB / 923 líneas.
- **Duplicación:** el footer está escrito 3 veces; A no usa el `ng-template #infoCards` de B/C y mantiene su propia implementación de horarios/dirección/contacto (`.info-block/.hours/.link-row` vs `.ic-card/.ic-hours/.ic-link`); A tampoco usa `#brandMark`.
- **El club elige a ciegas** en un `<select>` de texto (`tab-club.html:35`).
- Cada visitante baja el CSS de las tres plantillas y tres fuentes, use la que use.

## 2. Decisiones del owner (no re-decidir)

| Tema | Decisión |
|---|---|
| Qué es una plantilla | **Identidad visual pura.** El flujo de reserva es único y lo dicta la config del tenant (autoasignación, duraciones, seña, teléfono) |
| Lineup | **5**: A queda · B, C se rehacen · D y E nuevas |
| Tipografía | **Par propio por plantilla**, inyectado según la plantilla del tenant (SSR) |
| Esquema | **Una sola plantilla oscura** (B) |
| Elección en el panel | **Galería de miniaturas + preview en vivo** en iframe |
| Marketing | **Sección nueva** que demuestra la personalización |
| Arquitectura | **Shells como componentes**, flujo de reserva extraído y compartido |

## 3. Alcance

**Entra:** extracción del flujo/info/footer a componentes · dos stores · capa de tokens por plantilla · tipografía por plantilla vía SSR · `inkOnAccent` dark-safe · rediseño de B y C · plantillas D y E · aceptación de D/E en el back · galería + preview en el panel · sección de personalización en marketing.

**No entra (explícito):**
- Eliminar la columna `fuente` (limpieza aparte; ver §5.4).
- Claro/oscuro por preferencia del visitante.
- Copy editable por tenant: los textos de héroe ("Jugá esta noche") pertenecen a la **plantilla**, no al club.
- Miniaturas generadas por captura automática.
- Cualquier cambio al flujo de reserva (pasos, validaciones, seña, Mercado Pago).

---

## 4. Arquitectura

```
features/landing/
├─ landing.ts              # dispatcher: plantilla → loadComponent del shell (~60 líneas)
├─ shells/
│  ├─ a-afiche/    { shell.ts · shell.html · shell.scss · tokens.scss }
│  ├─ b-nocturna/  { … }
│  ├─ c-tarjeta/   { … }
│  ├─ d-cancha/    { … }
│  └─ e-diurna/    { … }
├─ booking/
│  ├─ booking-flow.ts/.html/.scss   # los 5 pasos, sin identidad propia
│  └─ booking.store.ts              # estado + validaciones + confirmar + éxito + seña
├─ club/
│  ├─ club-info.ts        # horarios · dónde · contacto — UNA implementación
│  ├─ brand-mark.ts
│  └─ landing-footer.ts   # arrepentimiento · política · panel — UNA implementación
└─ club.store.ts          # config pública, derivados, SEO, branding, params de preview

shared/plantilla-thumb/    # miniatura tokenizada — la consumen el panel y marketing,
                           # así que NO vive bajo features/landing
```

**Dos stores con fronteras claras.** `ClubStore` responde *quién es este club* (config pública vía `TransferState`, nombre, logo, horarios, contacto, colores, plantilla, `?plantilla=`/`?color=`, SEO). `BookingStore` responde *qué está reservando este visitante*. Cada uno se testea sin el otro.

**Dispatcher.** La plantilla llega de forma **síncrona** en el primer render por `TransferState` (`booking.service.ts:112`), así que el SSR emite el shell correcto de una — se conserva la propiedad que ya se ganó una vez de no mostrar 600 ms la plantilla equivocada. Cada visitante baja solo el chunk de su plantilla.

**Contrato shell → flujo.** El shell **no** re-estiliza el flujo con overrides (`.tpl-b .booking-flow { … }` desaparece). Declara tokens en su raíz y el flujo los consume:

```scss
.shell-<x> {
  --flow-surface · --flow-border · --flow-radius · --flow-shadow · --flow-gap · --flow-backdrop
  --font-display · --font-body · --font-mono
  --paper · --surface · --ink · --ink-dim · --ink-faint · --line
}
```

Agregar una plantilla = crear una carpeta y llenar ese contrato.

### 4.1 Registry de plantillas

Un módulo sin dependencias de Angular declara, por plantilla: código (`A`–`E`), nombre comercial, esquema (`light`/`dark`), tinta base (para `inkOnAccent`), fuentes a cargar y el `loadComponent` del shell. Lo consumen el dispatcher, la inyección de fuentes, la galería del panel y la sección de marketing — una sola fuente de verdad para "qué plantillas existen".

---

## 5. Tokens y white-label

### 5.1 Tres capas que no se pisan

| Capa | Dónde | Declara |
|---|---|---|
| 1 · Plataforma | `:root` en `styles.scss` | defaults de superficie/tinta/línea, trío tipográfico, radios (sirve a panel y marketing) |
| 2 · Plantilla | raíz del shell | pisa superficie/tinta/línea/tipografía/forma **y** define `--flow-*` |
| 3 · Tenant | inline en `<html>`, runtime | `--court --court-deep --court-soft --court-2 --ink-on-accent(-2)` + rampa PrimeNG |

**Regla invariante:** la capa 3 nunca declara superficie ni tinta; la capa 2 nunca declara `--court`. Los sets son disjuntos → sin peleas de especificidad y sin `!important`.

### 5.2 El color del club tiene rol asignado

Cada plantilla declara qué rol cumplen `--court` y `--court-2`, entre **masa** (fondo o bloque grande), **luz** (gradientes y halos), **estructura** (reglas, bordes, numeración) y **acento** (chips, botones, estados).

**Las cinco usan el color en masa** (ver §6) y las cinco le dan un rol explícito al secundario — que hoy, fuera de B, no lo usa nadie. El piso innegociable para cualquier plantilla futura: el color del club ocupa masa o luz, nunca solo acento.

### 5.3 Dark: `inkOnAccent` recibe la tinta del shell

`inkOnAccent()` hoy elige entre `#fff` y `var(--ink)` asumiendo que `--ink` es la tinta oscura `#11162b` (`tenant-colors.ts:38`). En un shell oscuro `--ink` es claro y devolver `var(--ink)` daría claro sobre claro. Pasa a `inkOnAccent(hex, inkRgb)`, con el valor saliendo del registry. Como la plantilla se conoce de forma síncrona, el primer paint ya sale bien.

### 5.4 Caché de arranque: la plantilla entra en la clave

`branding-boot.ts:10` cachea las variables ya resueltas bajo `padel_branding_${slug}`. Si el club cambia de plantilla —justo lo que la galería nueva fomenta—, un visitante que vuelve recibe un paint con la tinta de la plantilla vieja. La plantilla pasa a formar parte de la clave.

### 5.5 Sobre `fuente` (aclaración, no tarea)

El back **nulea** la columna cuando el campo no viene: `t.setFuente(fuente == null || fuente.isBlank() ? null : fuente.trim())` (`TenantBrandingService.java:51`). El reenvío defensivo del front (`config-state.service.ts:90`) está bien puesto y **se conserva**. Con tipografía por plantilla la columna queda sin uso, pero eliminarla es front + back + migración: fuera de este trabajo.

---

## 6. Las cinco plantillas

| | Concepto | Display + texto + datos | Rol del color | Firma |
|---|---|---|---|---|
| **A · Afiche** *(queda)* | Editorial, marca grande. En mobile el afiche se vuelve encabezado | Archivo expandida · Hanken Grotesk · Space Mono | primario **masa** · secundario **estructura** (filete) | la marca de agua con el nombre del club |
| **B · Nocturna** *(oscura)* | El club de noche bajo reflectores | Anton · Inter Tight · JetBrains Mono | primario **masa teñida + luz** · secundario **luz** (halo) | el horario elegido prende como luz de cancha |
| **C · Tarjeta** | App de consumo, pensada para el pulgar | Outfit · Inter | primario **masa** (header) + **acento** · secundario **acento** puntual | barra inferior con el recap vivo del turno |
| **D · Cancha** | El sistema visual sale de la cancha vista de arriba | IBM Plex Sans · IBM Plex Mono | primario **masa** (el campo) · secundario **estructura** (filo del CTA) | las líneas de la cancha como estructura de página |
| **E · Diurna** | La hermana clara de B: vidrio apoyado sobre el campo de color | Anton · Inter Tight · JetBrains Mono | primario **masa** (campo superior) · secundario **luz** (radial del campo) | el panel de vidrio a caballo del borde del color |

**El fondo oscuro de B no es negro neutro:** es el color del club oscurecido (`color-mix(in srgb, var(--court) 13%, #07090f)`), así un club rojo se siente cálido y uno teal, frío — el white-label se lee incluso en dark.

**El vidrio necesita sustancia detrás.** Es la razón por la que la B actual se ve lavada: sobre papel casi blanco el blur no tiene nada que difuminar. B lo resuelve con fondo oscuro con luz; E lo resuelve apoyando el panel a caballo del borde de un campo de color a plena saturación. Ninguna plantilla usa vidrio sobre blanco plano.

**E ya reusa el par tipográfico de B**, así que la quinta plantilla no agrega fuentes nuevas.

### 6.1 Contrato de diferenciación C ↔ E

C y E comparten esqueleto (color arriba, contenido abajo). Para que no terminen siendo primas, la diferencia queda escrita y no librada al gusto:

| | C · Tarjeta | E · Diurna |
|---|---|---|
| Contenedor | **varias** cards opacas apiladas | **un solo** panel de vidrio |
| Tipografía | Outfit, redonda, minúscula | Anton, condensada, mayúscula |
| Forma | radios 20–26px, sombras suaves | radio 18px, borde especular |
| CTA | barra anclada abajo (pulgar) | dentro del flujo |
| Tono del copy | cercano ("¿Cuándo jugás?") | imperativo ("Jugá hoy mismo") |

### 6.2 Tipografía por plantilla

El `<link>` de fuentes sale de `index.html:49` y pasa a inyectarse por área: el trío de plataforma para panel y marketing, y cada shell la suya (declarada en el registry). Un club en D no baja las fuentes de A. `preconnect` a Google Fonts se conserva global.

---

## 7. Galería en el panel

El `<select>` de `tab-club.html:35` se reemplaza por:

1. **Grilla de 5 miniaturas tokenizadas** (`<plantilla-thumb>`): HTML chico que usa `var(--court)`/`var(--court-2)`, así el club se ve con **sus** colores en las cinco antes de elegir. Sin imágenes ni iframes múltiples.
2. **Preview vivo del seleccionado**: iframe a `/?plantilla=<X>&color=%23RRGGBB` (mismo origen), aprovechando los params que ya existen en `landing.ts:126-131`. **Arranca en marco de teléfono (390px)** con toggle a escritorio, porque el producto se usa mayormente en mobile.

La selección sigue llamando a `setMarcaPlantilla()`: guardado y aviso de cambios sin guardar (`unsaved-changes.service.ts`) funcionan igual que hoy.

---

## 8. Sección de personalización en marketing

Sección nueva **"Tu marca · Tu club, con tu cara."** entre `#producto` y `#como-funciona`. Orden resultante: qué es → cómo se ve con tu marca → cómo arrancás → contacto.

En vez de afirmar que el producto es personalizable, lo demuestra: swatches de color que repintan las 5 miniaturas al instante, en un carrusel con `scroll-snap` que se recorre con el pulgar.

- Reusa el mismo `<plantilla-thumb>` de la galería del panel.
- Los swatches escriben `--court`/`--court-2` **en el contenedor de la sección**, no en el `<html>`: el resto de marketing conserva el teal de plataforma.
- La tinta legible sale de `inkOnAccent()`, la misma función pura del branding real.
- Cero imágenes: nada que se desactualice solo.

**Costado conocido:** las miniaturas son afiches, no la landing real renderizada. Si una plantilla cambia mucho, su miniatura se actualiza a mano.

---

## 9. Back: aceptar D y E

- `MarcaRequest.java:14` — `@Pattern(regexp = "^[A-Ca-c]$")` → `^[A-Ea-e]$` (y el mensaje).
- `TenantProvisioningService.java:216` — `up.matches("[ABC]")` → `[ABCDE]`.
- `TenantAdminService.parsePlantilla` — mismo rango.
- Comentarios de `TenantJpaEntity.plantilla` y `V10__plantilla.sql` actualizados.
- La columna `VARCHAR(1)` **aguanta sin migración**.

---

## 10. Testing

**Unitario**
- Matriz de contraste sobre 4 colores extremos (`#FFD400` amarillo, `#FFFFFF` blanco, `#111111` negro, `#FF2D95` fucsia), evaluando el **peor extremo** del gradiente (color base y `--court-deep` al 82%):
  - **Propiedad invariante:** la tinta elegida es siempre la de mejor peor-caso entre blanco y la tinta de la plantilla. Vale para cualquier color.
  - **Umbral ≥4.5:1** para amarillo, blanco y negro.
  - **Umbral ≥3:1** para fucsia. Con solo dos tintas posibles, un fucsia saturado no alcanza 4.5:1 contra ninguna (blanco da 3.45:1, tinta oscura 3.57:1 en el peor extremo). No es un bug del cálculo sino un límite del color.
  - **Regla de diseño que se deriva:** ningún shell pone **texto de párrafo** sobre `--court` crudo. Sobre el acento van solo textos grandes o bold (chips, botones, títulos), que se rigen por el umbral de 3:1. Para bloques con texto corrido, el shell usa `--court-deep` o una superficie propia.
- Sin browser, corre en milisegundos.
- Registry: cada plantilla declara esquema, tinta base, fuentes y shell.

**e2e (Playwright)**
- `plantillas.spec.ts` se extiende de 3 a **5 tenants** (uno por plantilla), conservando el helper `reservar()`: es la prueba de que el flujo único sobrevive a las cinco pieles.
- `preview.spec.ts` cubre `?plantilla=D` y `?plantilla=E`.
- `config.spec.ts` cubre elegir plantilla **desde la galería** y que persista.

**Responsive obligatorio** en cada shell: 360 · 390 · 768 · 1280. Mobile primero.

**Perf:** verificar en el build que la landing de un tenant trae un solo shell y un solo par tipográfico.

---

## 11. Fases y puertas

Cada fase termina con `npm run build` verde **y** la suite de Playwright completa verde. Ninguna fase empieza sin la anterior cerrada.

| # | Fase | Puerta específica |
|---|---|---|
| 0 | **Extracción sin cambios de pixel**: `booking-flow`, `club-info`, `brand-mark`, `landing-footer`, los dos stores. Se conservan clases y DOM; la info bespoke de A se mueve tal cual a su shell | `plantillas` · `preview` · `reserva` · `sena` verdes **sin tocar los specs** |
| 1 | Registry + capa de tokens + fuentes por SSR + `inkOnAccent` dark-safe + clave de caché con plantilla | matriz de contraste verde |
| 2 | Back acepta D y E | tests de back + caso que rechace `'F'` y acepte `'E'` |
| 3 | Shells nuevos, **uno por vez**: B → E → C → D | por shell: reserva completa e2e en su tenant + revisión visual en los 4 anchos |
| 4 | Galería + preview en el panel | `config.spec.ts` extendido |
| 5 | Sección de personalización en marketing | smoke e2e: los swatches repintan, el carrusel scrollea |
| 6 | Ajuste final de A y unificación de su info con `club-info` **si el pixel lo permite** | comparación visual antes/después |

Orden de la fase 3 deliberado: B primero porque es la que más cambia y la que valida la capa dark; E después porque hereda su tipografía; A al final porque es la que usan los tenants vivos.

---

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| `backdrop-filter` sin soporte (Firefox viejo, Android viejo) — B y E dependen del vidrio | `@supports not (backdrop-filter: blur(1px))` con fondo sólido equivalente en ambas. **No es opcional**: sin fallback la plantilla se cae entera |
| Colores extremos del club rompen contraste | matriz automatizada de §10, corriendo en CI |
| `X-Frame-Options`/`frame-ancestors` bloquean el preview | verificar **en la primera hora** de la fase 4. Plan B: preview en pestaña nueva y solo miniaturas en el panel |
| Regresión del flujo durante la extracción | fase 0 sin cambios de pixel + specs existentes sin tocar |
| Tenants vivos (`demo`, `riopadel`) están en A | A se toca al final, en fase 6 |
| Animaciones (haz de B, resplandores) molestan | `prefers-reduced-motion` respetado en las cinco |
| C y E convergen visualmente | contrato de §6.1, verificable mirando las dos miniaturas juntas |

---

## 13. Origen de las decisiones

Sesión de brainstorming del 2026-08-08 con el owner, con mockups mobile comparados en el companion visual (`.superpowers/brainstorm/2176-1786242301/`): `direcciones-arte.html` (las 4 primeras direcciones), `plantilla-e-blanca.html` (E1 vs E2 → **E1 elegida**), `marketing-personalizacion.html` (sección de marketing).
