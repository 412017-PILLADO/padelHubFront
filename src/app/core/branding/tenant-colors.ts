/**
 * Colores del club: tinta legible por contraste y escritura de los tokens CSS.
 *
 * Vive **aparte de `BrandingService` a propósito**: el servicio depende de `AgendaConfigService` (la
 * API del panel), así que importarlo desde la landing arrastraba todo ese árbol al chunk público.
 * Este módulo no depende de nada de Angular: recibe el `style` del `<html>` y trabaja.
 *
 * El caché de arranque está en ./branding-boot (ese sí entra al bundle inicial) y guarda el
 * resultado de `applyTenantColors` ya resuelto, para no llevarse esta matemática puesta.
 */

/** Parsea un hex `#rgb`/`#rrggbb` a sus componentes 0-255; `null` si no es un hex válido. */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Un canal sRGB (0-255) a lineal, para la fórmula de luminancia relativa de WCAG. */
function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG (0 = negro, 1 = blanco) de un color RGB. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** Ratio de contraste WCAG entre dos luminancias relativas. */
function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_INK_HEX = '#11162b'; // matchea --ink en styles.scss

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

/**
 * Repinta los componentes de PrimeNG con el color del club.
 *
 * El preset (`TealAura`, ver app.config.ts) fija el primary de la PLATAFORMA, así que sin esto el
 * datepicker, los botones del ConfirmDialog y los selects se quedaban en teal aunque el club fuera
 * rojo o naranja — lo único que no seguía la marca. Pisamos los tokens `--p-primary-*` con un estilo
 * inline en el `<html>` (gana sobre el `:root` que genera el tema) y derivamos la rampa con
 * `color-mix` desde el primario: no hace falta que el club cargue 11 tonos.
 */
function tokensPrimeNG(c: string): Record<string, string> {
  const tokens: Record<string, string> = {
    '--p-primary-color': c,
    // A propósito SIN pasarle la tinta del shell: los componentes de PrimeNG (datepicker, dialogs,
    // selects) se pintan sobre superficies claras del sistema en las tres plantillas, no sobre el
    // fondo de la cáscara. Cablearle la tinta de la plantilla —cuando la B pase a oscura— le daría
    // el contraste al revés justo acá. Esta llamada está bien como está: no la "arregles".
    '--p-primary-contrast-color': inkOnAccent(c),
    '--p-primary-hover-color': `color-mix(in srgb, ${c} 88%, #000)`,
    '--p-primary-active-color': `color-mix(in srgb, ${c} 78%, #000)`,
    '--p-primary-500': c,
  };
  // Rampa: hasta 400 se aclara con blanco, de 600 en adelante se oscurece con negro.
  const claros: [number, number][] = [[50, 8], [100, 16], [200, 30], [300, 50], [400, 75]];
  for (const [tono, pct] of claros) {
    tokens[`--p-primary-${tono}`] = `color-mix(in srgb, ${c} ${pct}%, #fff)`;
  }
  const oscuros: [number, number][] = [[600, 88], [700, 78], [800, 66], [900, 55], [950, 42]];
  for (const [tono, pct] of oscuros) {
    tokens[`--p-primary-${tono}`] = `color-mix(in srgb, ${c} ${pct}%, #000)`;
  }
  return tokens;
}

/**
 * Escribe los colores del tenant y sus derivados en un `:root` (el `style` del `<html>`).
 *
 * Única fuente de verdad: la usan tanto `BrandingService` (panel/login) como la landing, que antes
 * duplicaban estas mismas líneas — con el bug de que la landing nunca derivaba tinta para el
 * secundario. Cada color de fondo del tenant deja su tinta legible al lado (`--ink-on-accent` para
 * el primario, `--ink-on-accent-2` para el secundario) para que el CSS nunca tenga que hardcodear
 * `#fff`: un club con secundario blanco rompía el texto de todo lo pintado con el secundario.
 *
 * Devuelve las variables que dejó escritas: es lo que se cachea para repintar en el próximo arranque
 * sin recalcular nada (ver ./branding-boot).
 *
 * `inkHex` es la tinta base del shell (ver `decidirTinta`): opcional porque no todos los llamadores
 * conocen su plantilla (p. ej. `BrandingService`, que cae en la tinta oscura por defecto).
 */
export function applyTenantColors(
  root: CSSStyleDeclaration,
  primario?: string | null,
  secundario?: string | null,
  inkHex?: string,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const c = primario?.trim();
  if (c) {
    vars['--court'] = c;
    vars['--court-deep'] = `color-mix(in srgb, ${c} 82%, #000)`;
    vars['--court-soft'] = `color-mix(in srgb, ${c} 12%, #fff)`;
    vars['--ink-on-accent'] = inkOnAccent(c, inkHex);
    Object.assign(vars, tokensPrimeNG(c));
  }
  const c2 = secundario?.trim();
  if (c2) {
    vars['--court-2'] = c2;
    vars['--ink-on-accent-2'] = inkOnAccent(c2, inkHex);
  }
  for (const [prop, valor] of Object.entries(vars)) root.setProperty(prop, valor);
  if (!c2) {
    // Sin secundario el CSS cae al primario (var(--court-2, var(--court))), y su tinta también.
    root.removeProperty('--court-2');
    root.removeProperty('--ink-on-accent-2');
  }
  return vars;
}
