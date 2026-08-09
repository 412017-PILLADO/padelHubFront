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

/**
 * Ejes que se le piden a Google Fonts por familia. Van por familia y no fijos en `400..800` porque
 * la API css2 acepta cualquier peso (responde 200) pero entrega sólo las caras que existen — y en
 * el caso de las variables con más de un eje, pedir sólo `wght` DESCARTA los otros. Archivo es el
 * ejemplo caro: `.display` en styles.scss usa `font-stretch: 125%`, y sin el eje `wdth` Google
 * devuelve `font-stretch: 100%` y el display de todas las plantillas adelgaza.
 * Verificado contra fonts.googleapis.com: las diez familias responden 200 con caras.
 */
const EJES_POR_FAMILIA: Record<string, string> = {
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

/** URL de Google Fonts con todas las familias pedidas (ejes por familia + `display=swap`). */
export function urlFuentes(fuentes: string[]): string {
  const familias = fuentes.map((f) => {
    const nombre = f.trim();
    return `family=${nombre.replace(/\s+/g, '+')}:${EJES_POR_FAMILIA[nombre] ?? EJES_DEFAULT}`;
  });
  return `https://fonts.googleapis.com/css2?${familias.join('&')}&display=swap`;
}

/**
 * Familias del sistema de diseño de plataforma: las que declaran `--display`/`--body`/`--mono` en
 * styles.scss y de las que viven marketing, el panel y los modales de la landing. Hoy coinciden con
 * las de la plantilla A, pero se listan aparte a propósito: si la A cambia de tipografía en el
 * rediseño, la plataforma no tiene por qué seguirla.
 */
export const FUENTES_PLATAFORMA = ['Archivo', 'Hanken Grotesk', 'Space Mono'];
