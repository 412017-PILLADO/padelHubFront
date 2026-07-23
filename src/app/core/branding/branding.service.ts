import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AgendaConfigService } from '../api/agenda-config.service';

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

const DARK_INK_RGB: [number, number, number] = [0x11, 0x16, 0x2b]; // matchea --ink en styles.scss

/**
 * Texto legible (M11) sobre un fondo de color `hex`: compara el contraste WCAG del color contra
 * blanco puro y contra la tinta oscura del sistema (`--ink`), y devuelve el que gana — así un
 * primario claro (amarillo, celeste) no le pisa el texto blanco fijo a chips/botones/afiche.
 * `#fff` si `hex` no es parseable (mismo comportamiento que antes de M11).
 */
export function inkOnAccent(hex: string | null | undefined): string {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return '#fff';
  const l = relativeLuminance(rgb);
  const vsWhite = contrastRatio(l, 1);
  const vsInk = contrastRatio(l, relativeLuminance(DARK_INK_RGB));
  return vsWhite >= vsInk ? '#fff' : 'var(--ink)';
}

/**
 * Aplica la marca del tenant (color primario + logo) a toda la app, no solo a la landing.
 *
 * El color se escribe sobre las variables CSS `--court*` del `:root`, que son las que usan tanto la
 * página pública como el panel admin → con setearlas una vez se recolorea todo. El logo se expone
 * como `logoSrc` (URL absoluta lista para un `<img>`) para que la nav/login lo muestren.
 *
 * Fuentes de datos según el contexto:
 * - Panel autenticado (`loadAdmin`): `/api/v1/agenda/marca` (marca del tenant del JWT, siempre exacta).
 * - Login / landing (`apply`): datos ya cargados desde `/public/config` (resuelto por subdominio).
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly agenda = inject(AgendaConfigService);
  private readonly platformId = inject(PLATFORM_ID);

  /** URL absoluta del logo del club (o null → mostrar el nombre/ícono por defecto). */
  readonly logoSrc = signal<string | null>(null);

  /** Evita refetchear la marca del panel en cada navegación entre panel↔config. */
  private adminLoaded = false;

  /** Carga y aplica la marca del tenant autenticado. Idempotente por sesión de app. */
  loadAdmin(): void {
    if (this.adminLoaded || !isPlatformBrowser(this.platformId)) return;
    this.adminLoaded = true;
    this.agenda.getMarca().subscribe({
      next: (m) => this.apply(m.colorPrimario, m.colorSecundario, m.logoUrl),
      error: () => {
        // La marca es secundaria: si falla, el panel sigue con el color base. Permitimos reintentar.
        this.adminLoaded = false;
      },
    });
  }

  /** Aplica color primario + secundario + logo a partir de datos ya cargados (marca o config pública). */
  apply(colorPrimario?: string | null, colorSecundario?: string | null, logoUrl?: string | null): void {
    this.applyColor(colorPrimario, colorSecundario);
    this.logoSrc.set(this.resolveLogo(logoUrl));
  }

  /**
   * Setea el color primario del tenant y sus derivados (deep/soft, vía color-mix) en el `:root`, más
   * el secundario en `--court-2` (acento; si no hay, se quita y el grip cae al primario por CSS).
   * Solo en browser (en SSR no hay document). Espeja lo que hace la landing.
   */
  private applyColor(color?: string | null, colorSec?: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const root = document.documentElement.style;
    const c = color?.trim();
    if (c) {
      root.setProperty('--court', c);
      root.setProperty('--court-deep', `color-mix(in srgb, ${c} 82%, #000)`);
      root.setProperty('--court-soft', `color-mix(in srgb, ${c} 12%, #fff)`);
      // M11: texto legible sobre el primario (chips/botones/afiche) si el club usa un color claro.
      root.setProperty('--ink-on-accent', inkOnAccent(c));
    }
    const c2 = colorSec?.trim();
    if (c2) root.setProperty('--court-2', c2);
    else root.removeProperty('--court-2');
  }

  /** Resuelve la URL del logo: absoluta tal cual, o relativa al backend; null si no hay. */
  private resolveLogo(u?: string | null): string | null {
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
  }
}
