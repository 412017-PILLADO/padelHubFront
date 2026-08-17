import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { BookingService, PublicConfig } from '../../core/api/booking.service';
import { applyTenantColors } from '../../core/branding/tenant-colors';
import {
  CODIGOS_CON_SHELL,
  CodigoPlantilla,
  normalizarPlantilla,
} from '../../core/landing/plantillas';
import { environment } from '../../../environments/environment';

/** diaSemana 0..6 → Lunes..Domingo (matchea el contrato de /public/config). */
const DIA_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

export interface HoursRow {
  dias: string;
  rango: string;
  cerrado: boolean;
}

/**
 * Quién es este club: config pública, sus derivados (branding, horarios agrupados, contacto, seña) y
 * el preview de plantilla/color de la herramienta de venta. El flujo de reserva (día/hora/cancha/
 * confirmación) lo ignora por completo — ver `Landing`.
 */
@Injectable()
export class ClubStore {
  private readonly booking = inject(BookingService);
  private readonly platformId = inject(PLATFORM_ID);
  /** Inyectado (no el global): en SSR es el documento que se serializa, ver applyBranding(). */
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  // ── Config pública del tenant (GET /public/config) ────────────────
  readonly config = signal<PublicConfig | null>(null);

  /** Estado del fetch de la config pública. `error` es un estado propio y no "config sigue en
   *  null": el flujo de reserva necesita distinguirlos para arrancar con sus defaults y avisarle
   *  al visitante. */
  readonly estadoCarga = signal<'inicial' | 'cargando' | 'ok' | 'error'>('inicial');

  readonly tenantNombre = computed(() => this.config()?.complejo.nombre ?? 'Tu club');
  readonly tenantPrimerNombre = computed(() => this.tenantNombre().split(/\s+/)[0]);

  // ── Preview de plantilla/color por query params (herramienta de venta, 100% efímero) ──
  /** `?plantilla=` con uno de los códigos de `CODIGOS_CON_SHELL` (case-insensitive); cualquier otro
   *  valor → null. Se lee una sola vez al iniciar (solo browser) y desde ahí en más se maneja con
   *  el selector flotante. */
  readonly previewPlantilla = signal<CodigoPlantilla | null>(null);
  /** `?color=%23RRGGBB` (hex `#RGB`/`#RRGGBB`, validado); cualquier otro valor → null. Nunca se
   *  inyecta el valor crudo en CSS sin pasar por este regex. */
  readonly previewColor = signal<string | null>(null);
  /**
   * `?color2=%23RRGGBB`: el secundario del preview. Existe por la galería del panel — su iframe
   * tiene que poder mostrar el secundario SIN GUARDAR que el dueño está editando, o el preview
   * miente sobre la mitad de la marca justo mientras la está tocando. Mismo formato y misma
   * validación que `?color=`; sin él gana el secundario del tenant, que es lo correcto cuando nadie
   * lo tocó.
   */
  readonly previewColorSec = signal<string | null>(null);
  /**
   * `?panel=1`: apaga el selector flotante de venta.
   *
   * Adentro del iframe del panel ese selector es un SEGUNDO control desincronizado del formulario:
   * cambia lo que se ve sin tocar `marcaPlantilla`, así que el dueño elegiría ahí, vería una
   * plantilla y guardaría otra. La herramienta de venta (sin este param) no se entera de nada.
   */
  readonly previewSinSelector = signal(false);

  /** Plantilla de landing elegida por el club, ya normalizada contra el registry (ver
   *  core/landing/plantillas.ts): un código que el catálogo no conozca cae en la default 'C', así
   *  el `data-tpl` del host nunca expone un valor inventado por el back. El preview
   *  (`?plantilla=`) pisa la del tenant sin persistir nada. */
  readonly plantilla = computed<CodigoPlantilla>(() =>
    normalizarPlantilla(this.previewPlantilla() ?? this.config()?.tenant.plantilla)
  );

  /** Logo del club: si el tenant tiene uno, la URL absoluta lista para el <img>; si no, null. */
  readonly logoSrc = computed(() => {
    const u = this.config()?.tenant.logoUrl;
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
  });

  readonly mostrarPrecios = computed(() => this.config()?.tenant.mostrarPrecios ?? false);
  readonly requiereTelefono = computed(() => this.config()?.tenant.requiereTelefono ?? true);

  // ── Seña ──────────────────────────────────────────────────────────
  readonly senaMonto = computed(() => this.config()?.senaMonto ?? null);
  readonly senaMontoFmt = computed(() => {
    const m = this.senaMonto();
    return m != null ? m.toLocaleString('es-AR') : null;
  });
  readonly senaAlias = computed(() => this.config()?.senaAlias?.trim() || null);

  // ── Info del complejo ─────────────────────────────────────────────
  readonly direccion = computed(() => this.config()?.complejo.direccion ?? null);
  readonly mapaUrl = computed(() => this.config()?.complejo.mapaUrl ?? null);
  readonly whatsappRaw = computed(() => this.config()?.complejo.whatsapp ?? null);
  readonly whatsappUrl = computed(() => {
    const wa = this.whatsappRaw();
    return wa
      ? `https://wa.me/${wa.replace(/\D/g, '')}?text=` +
          encodeURIComponent('¡Hola! Quería consultar por un turno de pádel.')
      : null;
  });
  readonly instagramHandle = computed(() => this.config()?.complejo.instagram?.trim() || null);
  readonly instagramUrl = computed(() => {
    const h = this.instagramHandle();
    return h ? `https://instagram.com/${h}` : null;
  });

  readonly horarios = computed<HoursRow[]>(() =>
    agruparHorarios(this.config()?.horarios ?? [])
  );

  constructor() {
    // Se lee ANTES del fetch de config: el fetch es async (HTTP), así que para cuando la
    // respuesta llega y corre applyBranding() ya está seteado previewColor() y gana. El color se
    // aplica imperativamente (setProperty en :root, fuera del árbol que hidrata Angular), así que
    // no hay riesgo de mismatch aunque se lea/aplique ya en el constructor.
    const previewTpl = this.readPreviewParams();
    // previewPlantilla en cambio maneja el HTML que también sirve el server (host [attr.data-tpl]
    // + el @switch de plantilla en el template, ruta '' con RenderMode.Server): si se pisara acá,
    // síncrono, el primer render del cliente ya arrancaría distinto de lo que mandó el server y la
    // hidratación tira NG0500 (mismatch) con re-render destructivo. Por eso el override se aplica
    // recién DESPUÉS del primer render (afterNextRender) — el primer paint hidrata igual que el
    // server, y el preview entra como un segundo paint prolijo, ya del lado cliente.
    if (previewTpl) {
      afterNextRender(() => this.previewPlantilla.set(previewTpl));
    }
  }

  /**
   * Preview de venta: `?plantilla=` (uno de `CODIGOS_CON_SHELL`) y `?color=%23RRGGBB` pisan
   * visualmente el tenant sin
   * persistir nada. Solo en browser (en SSR no hay location) y solo se lee una vez al iniciar.
   * Aplica `previewColor` directo (ver constructor); devuelve la plantilla validada (o null) para
   * que el constructor decida CUÁNDO aplicarla. Después de este arranque, el selector flotante
   * actualiza `previewPlantilla` + la URL directamente (ya post-hidratación, sin este cuidado).
   */
  private readPreviewParams(): CodigoPlantilla | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const params = new URLSearchParams(location.search);

    // El `find` valida y tipa de una: nada de castear a CodigoPlantilla lo que vino en la URL. Se
    // acepta sólo lo que tiene cáscara: forzar D mostraría la A con el selector sin activa.
    const tpl = (params.get('plantilla') ?? '').trim().toUpperCase();
    const validTpl = CODIGOS_CON_SHELL.find((c) => c === tpl) ?? null;

    // La MISMA validación para los dos colores, factorizada a propósito: tener dos copias de esta
    // regex es exactamente cómo el secundario podría terminar entrando sin validar. Un valor
    // malformado (% suelto, un nombre de color, un hex corto raro) se ignora y el token queda null.
    const leerHex = (raw: string | null): string | null => {
      if (!raw) return null;
      try {
        const decoded = decodeURIComponent(raw);
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(decoded) ? decoded : null;
      } catch {
        return null;
      }
    };

    const color = leerHex(params.get('color'));
    if (color) this.previewColor.set(color);

    const colorSec = leerHex(params.get('color2'));
    if (colorSec) this.previewColorSec.set(colorSec);

    this.previewSinSelector.set(params.get('panel') === '1');

    return validTpl;
  }

  /** Click en el selector flotante (un botón por código de `CODIGOS_CON_SHELL`): cambia el preview
   *  en vivo y actualiza el query param
   *  (sin recargar) para que el link se pueda copiar tal cual se está viendo. */
  setPreviewPlantilla(tpl: CodigoPlantilla): void {
    this.previewPlantilla.set(tpl);
    if (!isPlatformBrowser(this.platformId)) return;
    const url = new URL(location.href);
    url.searchParams.set('plantilla', tpl);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  /** Fetch + branding + SEO. Idempotente: si ya hay `config()` cargada, no vuelve a pedirla. */
  cargar(): void {
    if (this.config()) return;
    this.estadoCarga.set('cargando');
    this.booking.config().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.applyBranding(cfg);
        this.applySeo(cfg);
        this.estadoCarga.set('ok');
      },
      error: () => {
        this.estadoCarga.set('error');
      },
    });
  }

  /**
   * Aplica la colorimetría del tenant al :root: el color primario y sus derivados (deep/soft, con
   * color-mix). Así cada club sale con su propio color sin tocar los estilos. El logo se resuelve
   * aparte vía logoSrc().
   *
   * Corre TAMBIÉN en el server (por eso `DOCUMENT` inyectado y no el global): el `style` del `<html>`
   * se serializa en el HTML que se sirve, así el **primer paint ya sale con el color del club**. Con
   * el guard de browser que había antes, el server mandaba el teal de plataforma y el color real
   * entraba recién al hidratar (~1s de parpadeo medido).
   */
  private applyBranding(cfg: PublicConfig): void {
    // El preview (`?color=`) pisa el color del tenant; ya viene validado por readPreviewParams().
    // Los derivados (deep/soft) y la tinta legible de cada color los resuelve el helper compartido
    // con BrandingService, que es la única fuente de verdad de los tokens de marca.
    //
    // No se le pasa nada de la plantilla: la tinta legible sobre el color del club sale sólo del
    // color, porque el texto cae SOBRE EL ACENTO y no sobre la superficie de la cáscara (ver
    // decidirTinta en core/branding/tenant-colors.ts). Antes acá se leía `PLANTILLAS[...].inkHex` y
    // en la B —cáscara oscura, tinta clara— eso desactivaba la decisión de contraste entera.
    const color = this.previewColor() ?? cfg.tenant.colorPrimario;
    // El secundario del preview pisa igual que el primario. Sin `?color2=` gana el del tenant, que
    // es lo correcto: el dueño que no tocó el secundario tiene que ver el que ya tiene guardado.
    const colorSec = this.previewColorSec() ?? cfg.tenant.colorSecundario;
    applyTenantColors(this.doc.documentElement.style, color, colorSec);
  }

  /**
   * Title + meta description por club, para que cada subdominio salga indexado con SU nombre (no el
   * de Padel-HUB, que es lo que trae index.html por defecto). Corre en SSR también: el fetch de
   * `/public/config` no está gateado a browser, así que esto ya queda seteado en el HTML servido
   * (la ruta '' se renderiza con RenderMode.Server — ver app.routes.server.ts).
   */
  private applySeo(cfg: PublicConfig): void {
    const nombre = cfg.complejo.nombre?.trim() || cfg.tenant.nombre?.trim() || 'Tu club';
    this.title.setTitle(`${nombre} — Reservá tu cancha`);
    const direccion = cfg.complejo.direccion?.trim();
    const desc = direccion
      ? `Reservá tu cancha en ${nombre} online, en segundos. ${direccion}.`
      : `Reservá tu cancha en ${nombre} online, en segundos.`;
    this.meta.updateTag({ name: 'description', content: desc });
  }
}

/**
 * Agrupa los horarios por franja en filas de display: por cada día (0..6 = Lun..Dom) el
 * span es min(inicio)–max(fin); días consecutivos con el mismo span se colapsan; sin
 * horario → "Cerrado".
 */
export function agruparHorarios(horarios: PublicConfig['horarios']): HoursRow[] {
  const spans: ({ from: string; to: string } | null)[] = Array(7).fill(null);
  for (const h of horarios) {
    if (h.diaSemana < 0 || h.diaSemana > 6) continue;
    const cur = spans[h.diaSemana];
    if (!cur) {
      spans[h.diaSemana] = { from: h.horaInicio, to: h.horaFin };
    } else {
      if (h.horaInicio < cur.from) cur.from = h.horaInicio;
      if (h.horaFin > cur.to) cur.to = h.horaFin;
    }
  }

  type Group = { start: number; end: number; sig: string; from: string; to: string };
  const groups: Group[] = [];
  for (let i = 0; i < 7; i++) {
    const span = spans[i];
    const sig = span ? `${span.from}-${span.to}` : 'closed';
    const last = groups[groups.length - 1];
    if (last && last.sig === sig) {
      last.end = i;
    } else {
      groups.push({ start: i, end: i, sig, from: span?.from ?? '', to: span?.to ?? '' });
    }
  }

  return groups.map((g) => {
    const cerrado = g.sig === 'closed';
    const dias =
      g.start === g.end
        ? `${DIA_SEMANA[g.start]}s`
        : `${DIA_SEMANA[g.start]} a ${DIA_SEMANA[g.end]}`;
    return { dias, rango: cerrado ? 'Cerrado' : `${g.from} — ${g.to}`, cerrado };
  });
}
