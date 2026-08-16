/**
 * Catálogo de plantillas de landing. Única fuente de verdad sobre "qué plantillas existen": la
 * consumen el dispatcher, la inyección de fuentes, la galería del panel y la sección de
 * personalización de marketing. Sin dependencias de Angular a propósito, para poder usarse desde
 * cualquiera de esos lugares sin arrastrar árboles ajenos.
 *
 * Todo lo que exporta es de sólo lectura: si esto es la fuente de verdad, nadie de afuera tiene
 * por qué poder editarla en caliente.
 */
export type CodigoPlantilla = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Plantilla {
  readonly codigo: CodigoPlantilla;
  readonly nombre: string;
  readonly descripcion: string;
  /**
   * Claro u oscuro. Es la única afirmación del registry sobre la colorimetría de la cáscara, y está
   * pineada contra la tinta que la hoja realmente declara (ver plantillas.spec.ts).
   *
   * Ya NO existe un `inkHex` al lado: la tinta del shell llegó a viajar hasta `decidirTinta()` para
   * elegir el texto sobre el color del club, y eso estaba mal — ese texto cae sobre el acento, no
   * sobre la superficie, así que la capa 2 no tiene nada que decidir ahí (ver tenant-colors.ts).
   */
  readonly esquema: 'light' | 'dark';
  readonly fuentes: readonly string[];
  /** Clase que la cáscara pone en su host. Pineada contra los shells reales en landing.spec.ts. */
  readonly claseShell: string;
}

export const PLANTILLAS: Readonly<Record<CodigoPlantilla, Plantilla>> = {
  A: { codigo: 'A', nombre: 'Afiche',   descripcion: 'Editorial, marca grande',   esquema: 'light', fuentes: ['Archivo', 'Hanken Grotesk', 'Space Mono'], claseShell: 'poster' },
  B: { codigo: 'B', nombre: 'Nocturna', descripcion: 'Oscura, luz de cancha',     esquema: 'dark',  fuentes: ['Anton', 'Inter Tight', 'JetBrains Mono'],   claseShell: 'tpl-b' },
  C: { codigo: 'C', nombre: 'Básica',   descripcion: 'Sobria, el color justo',    esquema: 'light', fuentes: ['Outfit', 'Inter'],                          claseShell: 'tpl-c' },
  D: { codigo: 'D', nombre: 'Cancha',   descripcion: 'Líneas y tablero',          esquema: 'light', fuentes: ['IBM Plex Sans', 'IBM Plex Mono'],           claseShell: 'tpl-d' },
  E: { codigo: 'E', nombre: 'Diurna',   descripcion: 'Clara, vidrio sobre color', esquema: 'light', fuentes: ['Anton', 'Inter Tight', 'JetBrains Mono'],   claseShell: 'tpl-e' },
};

export const CODIGOS_PLANTILLA: readonly CodigoPlantilla[] =
  Object.keys(PLANTILLAS) as CodigoPlantilla[];

/**
 * Códigos que hoy tienen cáscara propia y en qué carpeta de `features/landing/shells/` vive cada
 * una. El catálogo lista las cinco porque el back ya acepta las cinco, pero la cáscara de D todavía
 * no existe: hasta entonces `shellDePlantilla()` la manda a la C (ver su docblock).
 *
 * Es un MAPA y no una lista suelta porque el nombre de la carpeta hacía falta en dos lugares y
 * estaba escrito a mano en los dos: `plantillas.spec.ts` (que va a leer la hoja de cada cáscara para
 * pinear su `esquema`) y `booking/contrato-flow.spec.ts` (la puerta del contrato `--flow-*`). Una
 * cáscara nueva que no se agregaba a mano en el segundo quedaba SIN VERIFICAR con la suite entera en
 * verde — justo el modo de falla que esa puerta existe para matar. Ahora los dos derivan de acá y no
 * hay nada que sincronizar: alta de cáscara = un renglón en este mapa.
 */
export const DIR_SHELL = {
  A: 'a-afiche',
  B: 'b-nocturna',
  C: 'c-tarjeta',
  E: 'e-diurna',
} as const satisfies Partial<Record<CodigoPlantilla, string>>;

/** Un código que hoy tiene cáscara. Tiparlo así deja indexar `DIR_SHELL` sin castear ni chequear. */
export type CodigoConShell = keyof typeof DIR_SHELL;

/**
 * Los códigos del mapa de arriba, en orden de declaración. Lo consumen el dispatcher
 * (`shellDePlantilla`), el selector del preview de venta y el `?plantilla=` del ClubStore. Cuando
 * las cinco plantillas tengan cáscara, esto y `CODIGOS_PLANTILLA` pasan a ser lo mismo.
 */
export const CODIGOS_CON_SHELL: readonly CodigoConShell[] =
  Object.keys(DIR_SHELL) as CodigoConShell[];

/**
 * Normaliza a un código válido; cualquier cosa rara cae en la plantilla por defecto.
 *
 * LA DEFAULT ES C DESDE EL 2026-08-16, y antes era A. El cambio es de producto, no de código: C es
 * la sobria, la que le sirve a un club que no quiere elegir. A los tenants que ya existían se les
 * escribió `'A'` explícito en la base antes de mover esto (migración `V18__plantilla_explicita.sql`),
 * así que este cambio sólo alcanza a los clubes nuevos.
 */
export function normalizarPlantilla(v: string | null | undefined): CodigoPlantilla {
  const up = (v ?? '').trim().toUpperCase();
  return CODIGOS_PLANTILLA.some((c) => c === up) ? (up as CodigoPlantilla) : 'C';
}

/**
 * Qué cáscara termina dibujando un código. Es distinto de `normalizarPlantilla()`: ese contesta
 * "¿existe esta plantilla?" y a un tenant en D le devuelve 'D'; este contesta "¿qué puedo dibujar
 * hoy?" y a un tenant en D le devuelve 'C'.
 *
 * La diferencia no es cosmética. El `data-tpl` del host de la landing es lo que engancha las reglas
 * de layout de cada plantilla: `landing.scss` clava el viewport del afiche con
 * `:host([data-tpl='A']) { height: 100svh; overflow: hidden }`. Si un tenant en D publicara
 * `data-tpl="D"` y abajo se dibujara la cáscara A, la A quedaría con su `height: 100svh` adentro de
 * un host sin clamp y sin `overflow: hidden` — un afiche con doble scroll. Por eso el host publica
 * SIEMPRE el código de la cáscara que se está dibujando.
 */
export function shellDePlantilla(v: string | null | undefined): CodigoPlantilla {
  const codigo = normalizarPlantilla(v);
  return CODIGOS_CON_SHELL.some((c) => c === codigo) ? codigo : 'C';
}

/**
 * Ejes que se le piden a Google Fonts por familia. Van por familia y no fijos en `400..800` porque
 * la API css2 acepta cualquier peso (responde 200) pero entrega sólo las caras que existen — y en
 * el caso de las variables con más de un eje, pedir sólo `wght` DESCARTA los otros. Archivo es el
 * ejemplo caro: `.display` en styles.scss usa `font-stretch: 125%`, y sin el eje `wdth` Google
 * devuelve `font-stretch: 100%` y el display de todas las plantillas adelgaza.
 * Verificado contra fonts.googleapis.com: las diez familias responden 200 con caras.
 */
const EJES_POR_FAMILIA: Readonly<Record<string, string>> = {
  Archivo: 'wdth,wght@100..125,400..900',
  'Hanken Grotesk': 'wght@400;500;600;700;800',
  'Space Mono': 'wght@400;700',
  Anton: 'wght@400',
  'Inter Tight': 'wght@400;500;600;700;800',
  'JetBrains Mono': 'wght@400;500;600;700;800',
  Outfit: 'wght@400;500;600;700;800',
  Inter: 'wght@400;500;600;700;800',
  'IBM Plex Sans': 'wght@400;500;600;700',
  'IBM Plex Mono': 'wght@400;500;600;700',
};

/** Para una familia que todavía no esté en el mapa de arriba: el rango que usa el resto del sistema. */
const EJES_DEFAULT = 'wght@400;500;600;700;800';

/**
 * URL de Google Fonts con todas las familias pedidas (ejes por familia + `display=swap`). Sin
 * familias devuelve string vacío: una URL de css2 sin un solo `family=` no le sirve a nadie.
 */
export function urlFuentes(fuentes: readonly string[]): string {
  if (!fuentes.length) return '';
  const familias = fuentes.map((f) => {
    const nombre = f.trim();
    return `family=${nombre.replace(/\s+/g, '+')}:${EJES_POR_FAMILIA[nombre] ?? EJES_DEFAULT}`;
  });
  return `https://fonts.googleapis.com/css2?${familias.join('&')}&display=swap`;
}

/**
 * Familias del sistema de diseño de plataforma: las que declaran `--display`/`--body`/`--mono` en
 * styles.scss y de las que viven marketing, el panel y las plantillas de landing que no declaran
 * un par tipográfico propio (hoy A, C y D; B y E sí lo declaran, en su `:host`). Hoy
 * coinciden con las de la plantilla A, pero se listan aparte a propósito: si la A cambia de
 * tipografía en el rediseño, la plataforma no tiene por qué seguirla.
 *
 * Quien las carga es el `<link>` estático de `index.html`. Están acá para que el test pueda pinear
 * esa URL contra el registry (ver plantillas.spec.ts) y que las dos no se separen sin que nadie
 * se entere.
 */
export const FUENTES_PLATAFORMA: readonly string[] = ['Archivo', 'Hanken Grotesk', 'Space Mono'];
