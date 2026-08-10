import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AgendaConfigService } from '../api/agenda-config.service';
import { currentTenantSlug } from '../tenant/tenant';
import { guardarMarcaCacheada, leerMarcaCacheada } from './branding-boot';
import { applyTenantColors } from './tenant-colors';

/**
 * Plantilla bajo la que este archivo cachea la marca del panel/login. `brandingCacheKey` pide una
 * plantilla (ver ./branding-boot) y acá no hay ninguna real que pasarle: el panel es client-render,
 * así que hasta que la API contesta no sabemos cuál es la del tenant (ver core/landing/plantillas.ts).
 * Da igual, porque **nada de lo que se cachea depende de la plantilla**: lo cacheado es lo que
 * devuelve `applyTenantColors()`, que deriva todo del color del club y NO recibe ningún valor de la
 * cáscara (ver ./tenant-colors). Con la constante, todas las lecturas y escrituras de este archivo
 * caen en el mismo bucket, que además es el que lee el arranque (`app.config.ts`, también con 'A').
 * Si algún día el caché guardara algo que sí varía por plantilla, esta constante es lo único que hay
 * que tocar acá.
 */
const PLANTILLA_PANEL = 'A';

/**
 * Aplica la marca del tenant (color primario + secundario + logo) a toda la app, no solo a la
 * landing. El cálculo de los tokens vive en ./tenant-colors y el caché de arranque en
 * ./branding-boot: los dos sin dependencias, para que el arranque de la app pinte la marca sin
 * arrastrar la API del panel al bundle inicial de cualquier visitante público.
 *
 * Fuentes de datos según el contexto:
 * - Panel autenticado (`loadAdmin`): `/api/v1/agenda/marca`, la marca del tenant del JWT.
 * - Login (`apply`): datos ya cargados de `/public/config` (resuelto por subdominio).
 *
 * La landing pública NO pasa por acá: `ClubStore.applyBranding()` llama derecho a
 * `applyTenantColors()`. Los dos caminos la llaman igual —la función no acepta nada de la plantilla—
 * así que para un mismo color de club los tokens de marca salen idénticos vengan de donde vengan.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly agenda = inject(AgendaConfigService);
  private readonly platformId = inject(PLATFORM_ID);
  /** Inyectado y no el global: así el mismo código sirve en SSR (donde el `style` se serializa). */
  private readonly doc = inject(DOCUMENT);

  /** URL absoluta del logo del club (o null → mostrar el nombre/ícono por defecto). */
  readonly logoSrc = signal<string | null>(null);

  /** Evita refetchear la marca del panel en cada navegación entre panel↔config. */
  private adminLoaded = false;

  /** Slug del club para el caché; null en SSR (no hay localStorage ni marca que recordar). */
  private readonly slug = isPlatformBrowser(this.platformId) ? currentTenantSlug() : null;

  constructor() {
    // Los COLORES cacheados ya los aplica el arranque de la app (ver app.config.ts, antes del primer
    // paint). Acá recuperamos además el logo, que sí necesita el servicio para la nav: así el panel
    // no arranca con el ícono por defecto y lo cambia cuando contesta la API.
    const guardada = this.slug ? leerMarcaCacheada(this.slug, PLANTILLA_PANEL) : null;
    if (guardada) this.logoSrc.set(this.resolveLogo(guardada.logoUrl));
  }

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

  /**
   * Aplica color primario + secundario + logo a partir de datos ya cargados (marca o config pública)
   * y deja el resultado cacheado para que el próximo arranque pinte sin esperar a la API.
   */
  apply(colorPrimario?: string | null, colorSecundario?: string | null, logoUrl?: string | null): void {
    const vars = applyTenantColors(this.doc.documentElement.style, colorPrimario, colorSecundario);
    this.logoSrc.set(this.resolveLogo(logoUrl));
    if (this.slug) guardarMarcaCacheada(this.slug, PLANTILLA_PANEL, { vars, logoUrl: logoUrl ?? null });
  }

  /** Resuelve la URL del logo: absoluta tal cual, o relativa al backend; null si no hay. */
  private resolveLogo(u?: string | null): string | null {
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
  }
}
