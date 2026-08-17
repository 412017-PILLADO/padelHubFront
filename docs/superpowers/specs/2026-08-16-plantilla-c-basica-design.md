# Plantilla C · Básica — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado por el owner, listo para plan de implementación.
**Reemplaza:** la fila de C y la §6.1 completa de
`2026-08-08-plantillas-visuales-design.md`. El resto de esa spec sigue vigente.

---

## 1. Problema

**C no es la plantilla que dice ser.** El encabezado de su propia hoja dice *"PLANTILLA C ·
Minimalista — rail claro con hairlines, mucho blanco"*, y su layout de escritorio son **dos columnas
con un rail lateral sticky de 280px**. Pero el registry se la ofrece al dueño del club como *"C ·
Tarjeta — Tipo app, para el pulgar"*, y la spec vieja le pedía *"app de consumo, cards apiladas, CTA
anclado abajo"*.

O sea: el dueño elige "tipo app, para el pulgar" y recibe **una plantilla de escritorio con barra
lateral**. No es que C esté pobre — es que es otra cosa.

Y además nunca se rediseñó: es la original mudada a una cáscara. Se nota en el tamaño de su hoja
contra las que sí se rehicieron.

| cáscara | líneas de `shell.scss` |
|---|---|
| A · Afiche | 255 |
| B · Nocturna | 212 |
| E · Diurna | 166 |
| **C** | **62** |

**Lo que el owner dijo que le molesta**, textual: *"le falta personalidad"*, *"el rail lateral se
siente panel de admin"*, *"el color del club casi no aparece"*. Y sobre la dirección: *"mandaría más
a la minimalista… eso de las cards mucho no me gusta"*.

---

## 2. Decisiones del owner · no re-decidir

1. **Las cards apiladas quedan descartadas.** C deja de ser "Tarjeta".
2. **La firma es el LOMO** (elegida entre tres opciones mostradas: el índice, el dato que crece, el
   lomo).
3. **C pasa a ser la plantilla POR DEFECTO** del producto, el lugar que hoy ocupa A.
4. **El alcance de contenido no se recorta.** "Básica" es sobriedad visual y ser la default, no
   mostrar menos: C conserva marca, flujo, info del club y pie.
5. D sigue descartada. El catálogo se queda en cuatro.

---

## 3. Qué es C

### Concepto

Blanco, hairlines, cero decoración. **El color del club entra sólo como lomo y como acento — nunca
como masa.** Es la plantilla del club que quiere una página seria y que no le grite al jugador.

### La firma · el lomo

Una **banda vertical delgada del color del club, pegada al borde izquierdo del viewport, de arriba
abajo**, con un degradado suave hacia su versión clara. Como el lomo de un libro.

Es la firma porque cumple las tres cosas que una firma tiene que cumplir en este producto:

- **Está siempre**, en todos los anchos y en todo el scroll.
- **No ocupa lugar**: no le come espacio al contenido, que es lo que "básica" pide.
- **No se pisa con ninguna otra**: A es masa a la izquierda + marca de agua, B es telón oscuro +
  luz que prende, E es campo de color arriba + vidrio a caballo del borde.

**Restricción dura, heredada de lo que costó la plantilla D:** el lomo NO puede ser el único lugar
donde vive la identidad si su contraste depende del club. Con un club casi blanco, una banda de
`--court` crudo sobre papel casi desaparece. Ver §6 (contraste) para cómo se resuelve: el lomo lleva
un piso de contraste contra el papel, medido, y no se dibuja con el color crudo.

### El layout · se va el rail

En escritorio, C pasa a **una sola columna centrada** con ancho de lectura acotado: marca arriba,
flujo de reserva, info del club, pie. **La misma estructura en teléfono**, sin `display: contents` ni
reordenamientos.

Eso mata de raíz lo que el owner llamó "panel de admin", y de paso hace de C la cáscara más simple de
mantener: es la única que no cambia de estructura entre anchos.

### Tipografía

**Sigue con Outfit + Inter.** No suma familias al producto y la redonda de Outfit es coherente con
"sobria". No se toca `EJES_POR_FAMILIA`.

### Rol del color (spec §5.2)

| | |
|---|---|
| primario | **lomo** (la firma) + **acento** (chip elegido, borde del paso hecho, CTA) |
| secundario | acento puntual, opcional — si el club no lo tiene, cae al primario |

C **no** usa el primario como masa. Es la única de las cuatro que no lo hace, y ésa es su identidad.

---

## 4. La §6.1 reescrita · contrato de diferenciación C ↔ E

La versión vieja separaba C de E por "varias cards apiladas" contra "un solo panel de vidrio", y por
"CTA anclado abajo" contra "CTA dentro del flujo". **Las dos mitades de C quedaron descartadas**, así
que el contrato se rehace entero. La separación nueva es más limpia que la anterior:

| | C · Básica | E · Diurna |
|---|---|---|
| **Rol del color** | lomo + acento, **nunca masa** | **masa**: campo de color a plena saturación |
| **Contenedor** | ninguno: el contenido se apoya en el papel, separado por hairlines | un panel de vidrio a caballo del borde del campo |
| **Firma** | la banda vertical en el borde | el solape del vidrio sobre el canto del color |
| **Tipografía** | Outfit, redonda, minúscula | Anton, condensada, mayúscula |
| **Forma** | hairlines de 1px, radios chicos, sin sombra | radio 18px, borde especular, blur |
| **Layout** | una columna, igual en todos los anchos | campo arriba + panel montado |

**La prueba de que el contrato se cumple:** puestas una al lado de la otra con el mismo club, la
diferencia se tiene que poder nombrar sin mirar la tipografía. Si alguien tiene que decir "son
parecidas pero con otra fuente", el contrato falló.

---

## 5. El cambio de default

Es un cambio de **producto**, no de cáscara, y arrastra tres cosas.

### 5.1 Los tres lugares que apuntan a A

| dónde | hoy | pasa a |
|---|---|---|
| `normalizarPlantilla()` · `core/landing/plantillas.ts` | un código desconocido cae en `'A'` | `'C'` |
| `shellDePlantilla()` · mismo archivo | un código sin cáscara cae en `'A'` | `'C'` |
| `@default` del `@switch` · `landing.html` | `<app-shell-a>` | `<app-shell-c>` |

Los tres tienen tests que asumen A. **Se actualizan con intención, no a las apuradas**: cada uno
existe por un motivo distinto y el motivo no cambió — cambió a qué plantilla apunta.

### 5.2 Migración · los clubes que hoy no eligieron nada

**Están viendo A. Si la default se mueve sin más, les cambia la página sin que hayan tocado nada.**

**Decisión: antes de mover la default, se les escribe `'A'` explícito en la base a todos los tenants
existentes.** Después de eso, el cambio de default aplica **sólo a clubes nuevos**.

Es una migración de datos en el back (los tenants ya tienen la columna `plantilla`, así que es un
`UPDATE` sobre los que la tengan nula o vacía). Nadie se despierta con otra página.

### 5.3 Los fallbacks del contrato `--flow-*` · **no se tocan**

Los diecisiete tokens del contrato dicen *"cada token trae como fallback el valor de la plantilla A,
así una cáscara que se olvide de declarar uno se ve como la A en vez de romperse"*.

**Se dejan en A y sólo se corrige la redacción.** Ese fallback protege a *una cáscara que se olvidó
de declarar un token*, que es un problema distinto de *qué plantilla es la default*. Moverlos a los
valores de C sería tocar las cuatro cáscaras por una coincidencia de nombres.

Lo único que se cambia es el comentario, para que no diga "la default" cuando quiere decir "la A".

---

## 6. Contraste · lo que hay que medir

C es clara, así que hereda los problemas de las claras. Todo se mide contra **las seis paletas de la
casa**: teal de plataforma, naranja del demo, amarillo, casi blanco, casi negro, fucsia.

### 6.1 El lomo

Es la firma, así que **no puede desaparecer con ningún club**. Con un club casi blanco, una banda de
`--court` crudo sobre `--paper` queda invisible.

Se resuelve como se resolvió el mismo problema en la fase D: la banda **no se dibuja con el color
crudo**, sino con el color llevado hacia la tinta lo justo para garantizar un piso de contraste
contra el papel. El porcentaje exacto **se mide y se pinea**, no se elige a ojo.

`--flow-cta-edge` de C no se toca: ya se resolvió en la rama del filo del CTA.

### 6.2 Dos deudas medidas que viven en los archivos que esta fase toca

Están registradas en el documento de estado (§5) y **se pagan acá**, porque están en el código que se
va a reescribir igual:

| deuda | dónde | número medido |
|---|---|---|
| `--flow-soft-ink-accent` usa `--court-deep` | `c-tarjeta/_tokens.scss` | abajo de AA en **4 de 6** paletas; naranja del demo **2,98:1**. Receta que sí funciona, ya medida: `mix(--court 40%, --ink)`, techo 41,34% |
| El hover del pie de C | `landing-footer.scss`, bloque `:host(.c-foot)` | abajo de AA en 3 de 6, y **por debajo del estado normal en 5 de 6** — pasar el mouse *empeora* la legibilidad |

El bloque de A en esa misma hoja **no se toca**: es otra deuda y otra fase.

---

## 7. Acoplamientos que hay que resolver

Sacar el rail rompe reglas que viven en **hojas compartidas** y apuntan a clases de C. Hay que
tratarlas explícitamente, no descubrirlas cuando algo se ve raro:

| dónde | qué | qué hacer |
|---|---|---|
| `club/brand-mark.ts:55-57` | `:host-context(.c-brandline)` fija el tamaño del logo y de la marca | **`.c-brandline` sobrevive**, como clase del encabezado nuevo en vez de fila del rail. Es la opción de menos movimiento: la regla de `brand-mark` sigue valiendo tal cual y no hay que mudar nada a una hoja compartida |
| `club/club-info.scss:60` | `:host-context(.c-rail)` apila el horario en el rail angosto | `.c-rail` desaparece: la regla se borra |
| `club/club-info.scss:54-55` | `:host-context(.tpl-c)` da radio 14px y el fondo del ícono | `.tpl-c` **sobrevive** (es `claseShell` en el registry). Revisar que los valores sigan teniendo sentido con la C nueva |
| `booking/booking-flow.ts:18` | menciona `.tpl-c .flow-head .mono` como regla histórica | verificar que ya no exista; si existe, sale |

**Ninguna cáscara puede apuntar al DOM del flujo** (spec §5.1). Lo que C necesite del
`<app-booking-flow>` sale por tokens `--flow-*`, como hoy.

---

## 8. Testing · las puertas

| puerta | qué exige |
|---|---|
| `c-tarjeta/contraste.spec.ts` | existe y hay que **reescribirlo**: pinea el lomo (piso contra el papel con las seis paletas), el acento, y la receta nueva de `--flow-soft-ink-accent`. Lee las hojas como TEXTO — jsdom no aplica la cascada, un `getComputedStyle` saldría verde siempre |
| `booking/contrato-flow.spec.ts` | ya exige que toda cáscara de `DIR_SHELL` declare los diecisiete tokens, sin huérfanos. Tiene que quedar verde solo |
| `plantillas.spec.ts` | pinea el `esquema` del registry contra la tinta que la hoja declara. C sigue siendo `light` |
| `landing.spec.ts` | pinea `claseShell` contra los shells reales, y **el `@default`**: hay que moverlo a C con intención |
| `club/pie-por-cascara.spec.ts` | exige bloque de pie con `color` en reposo para los dos `<button>`. El arreglo del hover no puede romperlo |
| e2e `plantillas.spec.ts` | la fila de C (`urbanpadel`) renderiza su layout y reserva hasta el éxito. **Hay que actualizar los selectores del rail** |
| default, en unit | `normalizarPlantilla(null)` y `shellDePlantilla('D')` devuelven `'C'`. Es donde vive la decisión, y es barato de pinear |
| default, en e2e | **un tenant recién creado** dibuja C. No sirve "un tenant sin plantilla": después de la migración de §5.2 ninguno de los existentes queda en nulo, a propósito. El alta de club de `plataforma.spec.ts` ya crea tenants — ése es el que tiene que salir en C |

**Toda puerta nueva se prueba en rojo antes de darla por buena.** Un test que nunca se vio fallar no
es una puerta — es la lección más cara de las fases anteriores.

---

## 9. Riesgos

| riesgo | mitigación |
|---|---|
| **C y E vuelven a parecerse.** Las dos son claras y las dos ponen el color arriba | El contrato §4 lo declara y la revisión visual las compara lado a lado con el mismo club |
| **El lomo desaparece con un club casi blanco** | §6.1: piso de contraste medido y pineado, no color crudo |
| **El cambio de default le cambia la página a un club real** | §5.2: se escribe `'A'` explícito antes de mover nada |
| **"Sobria" termina siendo "sin terminar"** | Es exactamente lo que el owner criticó de la C actual. La revisión visual con las seis paletas es la puerta, y no la reemplaza ningún test |
| **Sacar el rail rompe hojas compartidas en silencio** | §7 las lista una por una |

---

## 10. Lo que este trabajo NO hace

- **No toca A, B ni E.** Sólo se corrige el comentario de los fallbacks (§5.3) y, en la hoja del pie,
  únicamente el bloque de C.
- **No recorta contenido.** "Básica" no es "corta" — decisión explícita del owner.
- **No arregla la deuda del pie de A** ni la inversión figura/fondo del club casi blanco. Son otras
  fases, listadas en el documento de estado §5.
- **No agrega una quinta plantilla.** El catálogo se queda en cuatro.
