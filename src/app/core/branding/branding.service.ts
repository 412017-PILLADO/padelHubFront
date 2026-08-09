import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AgendaConfigService } from '../api/agenda-config.service';
import { currentTenantSlug } from '../tenant/tenant';
import { guardarMarcaCacheada, leerMarcaCacheada } from './branding-boot';
import { applyTenantColors } from './tenant-colors';

/**
 * Aplica la marca del tenant (color primario + secundario + logo) a toda la app, no solo a la
 * landing. El cálculo de los tokens vive en ./tenant-colors y el caché de arranque en
 * ./branding-boot: los dos sin dependencias, para que el arranque de la app pinte la marca sin
 * arrastrar la API del panel al bundle inicial de cualquier visitante público.
 *
 * Fuentes de datos según el contexto:
 * - Panel autenticado (`loadAdmin`): `/api/v1/agenda/marca`, la marca del tenant del JWT.
 * - Login / landing (`apply`): datos ya cargados de `/public/config` (resuelto por subdominio).
 */
/**
 * Plantilla bajo la que este archivo cachea la marca del panel/login. El panel es client-render:
 * hasta que la API contesta no sabemos cuál es la plantilla real del tenant (ver
 * core/landing/plantillas.ts), así que cacheamos siempre bajo la default del sistema. Es inofensivo
 * hoy: acá la tinta NO varía por plantilla (eso sólo lo hace `ClubStore.applyBranding`, para la
 * landing pública, en base al esquema claro/oscuro del shell) — así que todas las lecturas y
 * escrituras de este archivo caen siempre en el mismo bucket, sin pisar ni ser pisadas por el de
 * ninguna otra plantilla. Si el panel alguna vez empieza a variar la tinta por plantilla, esta
 * constante es lo único que hay que tocar acá.
 */
const PLANTILLA_PANEL = 'A';

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
