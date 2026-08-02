import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  PLATFORM_ID,
  afterNextRender,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  BookingService,
  CanchaLibre,
  PublicConfig,
  Slot,
} from '../../core/api/booking.service';
import { inkOnAccent } from '../../core/branding/branding.service';
import { ArrepentimientoModal } from './arrepentimiento-modal/arrepentimiento-modal';
import { PoliticaModal } from './politica-modal/politica-modal';

const MES_ABBR = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const DOWS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];
/** Abreviatura del día para el recap compacto ("Vie 24/07"). Índice = Date.getDay() (0=Domingo). */
const DOW_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** diaSemana 0..6 → Lunes..Domingo (matchea el contrato de /public/config). */
const DIA_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

export interface HoursRow {
  dias: string;
  rango: string;
  cerrado: boolean;
}

const ES_TRANSLATION = {
  firstDayOfWeek: 1,
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
  monthNamesShort: [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    DatePickerModule,
    InputTextModule,
    ToastModule,
    NgTemplateOutlet,
    ArrepentimientoModal,
    PoliticaModal,
  ],
  providers: [MessageService],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { '[attr.data-tpl]': 'plantilla()' },
})
export class Landing {
  private readonly booking = inject(BookingService);
  private readonly messages = inject(MessageService);
  private readonly primeng = inject(PrimeNG);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  // ── Config pública del tenant (GET /public/config) ────────────────
  readonly config = signal<PublicConfig | null>(null);

  readonly tenantNombre = computed(() => this.config()?.complejo.nombre ?? 'Tu club');
  readonly tenantPrimerNombre = computed(() => this.tenantNombre().split(/\s+/)[0]);

  // ── Preview de plantilla/color por query params (herramienta de venta, 100% efímero) ──
  /** `?plantilla=A|B|C` (case-insensitive); cualquier otro valor → null. Se lee una sola vez al
   *  iniciar (solo browser) y desde ahí en más se maneja con el selector flotante. */
  readonly previewPlantilla = signal<string | null>(null);
  /** `?color=%23RRGGBB` (hex `#RGB`/`#RRGGBB`, validado); cualquier otro valor → null. Nunca se
   *  inyecta el valor crudo en CSS sin pasar por este regex. */
  readonly previewColor = signal<string | null>(null);

  /** Plantilla de landing elegida por el club: 'A' (poster), 'B' (hero), 'C' (app). Default 'A'.
   *  El preview (`?plantilla=`) pisa la del tenant sin persistir nada. */
  readonly plantilla = computed(() =>
    (this.previewPlantilla() ?? this.config()?.tenant.plantilla ?? 'A').toUpperCase()
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
  readonly requiereSena = computed(() => this.config()?.requiereSena ?? false);
  readonly senaMonto = computed(() => this.config()?.senaMonto ?? null);
  readonly senaMontoFmt = computed(() => {
    const m = this.senaMonto();
    return m != null ? m.toLocaleString('es-AR') : null;
  });
  readonly senaAlias = computed(() => this.config()?.senaAlias?.trim() || null);
  /** Feedback breve del botón "Copiar" del alias en la pantalla de éxito. */
  readonly aliasCopiado = signal(false);
  /** Link de Checkout Pro para pagar la seña online (null = solo alias por transferencia). */
  readonly senaInitPoint = signal<string | null>(null);

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

  /** El item "El club" de la nav de la plantilla C apunta a la card de dirección si existe
   *  (`#ic-donde`, ver `infoCards`); si el club no cargó dirección pero sí tiene WhatsApp/IG,
   *  esa card no se renderiza y hay que apuntar a `#ic-contacto` en su lugar (misma condición de
   *  visibilidad del item: `direccion() || whatsappUrl() || instagramHandle()`). */
  readonly clubAnchorId = computed(() => (this.direccion() ? 'ic-donde' : 'ic-contacto'));

  readonly horarios = computed<HoursRow[]>(() =>
    groupHorarios(this.config()?.horarios ?? [])
  );

  readonly today = startOfDay(new Date());
  readonly minDate = this.today;

  // ── Paso 1 · Duración ─────────────────────────────────────────────
  readonly duraciones = computed(() => this.config()?.duracionesPermitidas ?? [60, 90, 120]);
  readonly duracion = signal<number>(90);

  /**
   * Mostramos el paso de duración solo si el club permite otras duraciones y hay más de una. Si no,
   * todos juegan el turno principal y nos salteamos el paso → reserva más rápida.
   */
  readonly showDuracion = computed(
    () => this.config()?.permitirOtrasDuraciones !== false && this.duraciones().length > 1
  );
  /**
   * Mostramos el paso de elegir cancha salvo que el club use autoasignación: en ese caso el sistema
   * asigna la menos cargada y le sacamos el paso al cliente (reserva más corta).
   */
  readonly showCancha = computed(() => this.config()?.autoasignacion !== true);
  /** Numeración de los pasos visibles (corre según qué pasos se muestran). */
  readonly stepNums = computed(() => {
    let n = 0;
    const num = () => String(++n).padStart(2, '0');
    return {
      dur: this.showDuracion() ? num() : '',
      dia: num(),
      hora: num(),
      cancha: this.showCancha() ? num() : '',
      datos: num(),
    };
  });

  // ── Paso 2 · Día ──────────────────────────────────────────────────
  readonly selectedDay = signal<Date | null>(null);
  readonly calOpen = signal(false);
  readonly pickerValue = signal<Date | null>(null);

  // ── Paso 3 · Hora ─────────────────────────────────────────────────
  readonly slots = signal<Slot[]>([]);
  readonly loadingSlots = signal(false);
  readonly slotsLoaded = signal(false);
  readonly selectedTime = signal<string | null>(null);

  // ── Paso 4 · Cancha ───────────────────────────────────────────────
  /** Token "ANY" = cualquiera disponible (canchaId null). */
  readonly ANY = -1;
  readonly selectedCancha = signal<number | null>(null);

  // ── Paso 5 · Datos ────────────────────────────────────────────────
  readonly nombre = signal('');
  readonly whatsapp = signal('');
  readonly empresa = signal('');
  readonly enviando = signal(false);

  // ── Botón de arrepentimiento (Res. 424/2020) ───────────────────────
  readonly showArrep = signal(false);

  // ── Política de cancelación (texto libre del club) ─────────────────
  readonly showPolitica = signal(false);

  readonly success = signal(false);
  readonly successData = signal<{
    cancha: string;
    dia: string;
    hora: string;
    duracion: number;
    primerNombre: string;
    nombreCompleto: string;
    pendiente: boolean;
    senaMonto: string | null;
    senaAlias: string | null;
  } | null>(null);

  /** Link de WhatsApp para mandar el comprobante de la seña (usa el turno recién reservado). */
  readonly whatsappSenaUrl = computed(() => {
    const wa = this.whatsappRaw();
    const d = this.successData();
    if (!wa || !d) return null;
    const msg =
      `¡Hola! Soy ${d.nombreCompleto}. Te paso el comprobante de la seña ` +
      `de mi turno: ${d.cancha}, ${d.dia} a las ${d.hora}.`;
    return `https://wa.me/${wa.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  });

  // ── Day chips ─────────────────────────────────────────────────────
  readonly chips = computed(() => [
    { label: 'Hoy', date: this.today },
    { label: 'Mañana', date: addDays(this.today, 1) },
    { label: 'Pasado', date: addDays(this.today, 2) },
  ]);

  /** Día elegido con el calendario, fuera de los chips Hoy/Mañana/Pasado. */
  readonly customDay = computed(() => {
    const day = this.selectedDay();
    if (!day || this.chips().some((c) => sameDay(day, c.date))) return null;
    return day;
  });

  // ── Estado derivado ───────────────────────────────────────────────
  readonly dayDone = computed(() => this.selectedDay() !== null);
  readonly timeDone = computed(() => this.selectedTime() !== null);
  readonly canchaDone = computed(() => this.selectedCancha() !== null);

  /** Slot actualmente elegido (para listar sus canchas libres). */
  readonly currentSlot = computed(() =>
    this.slots().find((s) => s.hora === this.selectedTime()) ?? null
  );
  readonly canchasDelSlot = computed<CanchaLibre[]>(
    () => this.currentSlot()?.canchasLibres ?? []
  );

  // Validación por campo (antes era silenciosa: formValid las combinaba sin exponer el motivo).
  readonly nombreValid = computed(() => this.nombre().trim().length >= 2);
  readonly whatsappValid = computed(() => {
    if (!this.requiereTelefono()) return true;
    return this.whatsapp().replace(/\D/g, '').length >= 6;
  });
  readonly formValid = computed(() => this.nombreValid() && this.whatsappValid());
  readonly canConfirm = computed(() => this.canchaDone() && this.formValid());
  readonly formOpen = computed(() => this.canchaDone());

  /** Tocado = el campo perdió el foco al menos una vez; recién ahí mostramos su hint de error. */
  readonly nombreTouched = signal(false);
  readonly whatsappTouched = signal(false);

  /** Por qué está deshabilitado "Confirmar turno" (null si puede confirmarse). Solo considera los
   * campos ya tocados, para no arrancar la pantalla con errores antes de que el cliente escriba. */
  readonly confirmBlockedReason = computed(() => {
    if (!this.nombreValid() && this.nombreTouched()) return 'Ingresá tu nombre (mínimo 2 letras).';
    if (!this.whatsappValid() && this.whatsappTouched()) {
      return 'Ingresá un WhatsApp válido (mínimo 6 dígitos).';
    }
    if (!this.formValid()) return 'Completá tu nombre' + (this.requiereTelefono() ? ' y WhatsApp.' : '.');
    return null;
  });

  /**
   * Precio a mostrar junto al horario y en el recap (M2): con una cancha puntual elegida, el precio
   * EFECTIVO de esa cancha en el slot elegido (ya viene con la franja horaria aplicada por el back);
   * con autoasignación o "Cualquiera disponible" y un horario ya elegido, el precio exacto si todas
   * las canchas del slot cobran lo mismo, o "desde $mínimo" si varía por cancha — usando siempre los
   * precios efectivos del slot, no el precio estático de la config pública. Antes de elegir horario
   * (todavía no hay slot), cae al precio estático por cancha, considerando también el mínimo de las
   * franjas horarias configuradas (`precioFranjas`): puede haber un horario más barato que el precio
   * base. null si el club no muestra precios o no hay ningún precio cargado.
   */
  readonly precioResumen = computed<{ texto: string; desde: boolean } | null>(() => {
    if (!this.mostrarPrecios()) return null;
    const seleccion = this.selectedCancha();

    if (seleccion !== null && seleccion !== this.ANY) {
      // Cancha puntual elegida: precio efectivo de esa cancha en el slot seleccionado.
      const c = this.canchasDelSlot().find((x) => x.id === seleccion);
      const precio = c ? this.precioTurno(c) : null;
      return precio ? { texto: `$${precio}`, desde: false } : null;
    }

    if (this.selectedTime() !== null) {
      // Horario ya elegido (autoasignación / "cualquiera disponible"): precios efectivos del slot.
      const precios = this.canchasDelSlot()
        .map((c) => c.precioHora)
        .filter((p): p is number => p != null && p > 0);
      if (!precios.length) return null;
      const min = Math.min(...precios);
      const max = Math.max(...precios);
      const total = Math.round((min * this.duracion()) / 60).toLocaleString('es-AR');
      return min === max ? { texto: `$${total}`, desde: false } : { texto: `desde $${total}`, desde: true };
    }

    // Sin horario elegido todavía: candidatos = precio base de cada cancha y ese mismo precio con
    // cada ajuste porcentual de franja aplicado (un descuento en cierto horario puede dejar un
    // turno más barato que el precio base de cualquier cancha).
    const canchas = this.config()?.canchas ?? [];
    const franjas = this.config()?.precioFranjas ?? [];
    const basePrecios = canchas
      .map((c) => c.precioHora)
      .filter((p): p is number => p != null && p > 0);
    if (!basePrecios.length) return null;
    const conAjustes = basePrecios.flatMap((p) =>
      franjas.map((f) => Math.round((p * (100 + f.ajustePorcentaje)) / 100)),
    );
    const precios = [...basePrecios, ...conAjustes];
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const total = Math.round((min * this.duracion()) / 60).toLocaleString('es-AR');
    // Si hay franjas cargadas el precio siempre puede variar según el horario, aunque hoy el
    // mínimo coincida con el máximo: mostramos "desde" para no prometer un precio fijo.
    const desde = min !== max || franjas.length > 0;
    return desde ? { texto: `desde $${total}`, desde: true } : { texto: `$${total}`, desde: false };
  });

  /** true si el precio efectivo de esta cancha en el slot difiere del precio habitual (estático) de
   *  esa misma cancha en la config pública: indica que está pisado por una franja horaria especial. */
  precioEsEspecial(c: CanchaLibre): boolean {
    if (c.precioHora == null) return false;
    const base = this.config()?.canchas.find((x) => x.id === c.id)?.precioHora ?? null;
    return base != null && base !== c.precioHora;
  }

  /** Recap compacto del turno elegido, junto al botón "Confirmar turno" (M10). */
  readonly recap = computed(() => {
    const day = this.selectedDay();
    const hora = this.selectedTime();
    if (!day || !hora) return null;
    const cancha = !this.showCancha()
      ? 'Se asigna al confirmar'
      : this.selectedCancha() === this.ANY
        ? 'Cualquiera disponible'
        : (this.canchasDelSlot().find((c) => c.id === this.selectedCancha())?.nombre ?? 'Se asigna al confirmar');
    return {
      dia: this.recapDay(day),
      hora: `${hora} hs`,
      duracion: this.duracion(),
      cancha,
      precio: this.precioResumen(),
    };
  });

  readonly timeHint = computed(() => {
    if (!this.selectedDay()) return 'Elegí primero el día.';
    if (this.loadingSlots()) return 'Buscando turnos…';
    if (this.slotsLoaded() && this.slots().length === 0) {
      return 'Sin turnos para esta fecha y duración.';
    }
    return '';
  });
  readonly showTimes = computed(
    () => this.dayDone() && !this.loadingSlots() && this.slots().length > 0
  );

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
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
    this.loadConfig();
  }

  /**
   * Preview de venta: `?plantilla=A|B|C` y `?color=%23RRGGBB` pisan visualmente el tenant sin
   * persistir nada. Solo en browser (en SSR no hay location) y solo se lee una vez al iniciar.
   * Aplica `previewColor` directo (ver constructor); devuelve la plantilla validada (o null) para
   * que el constructor decida CUÁNDO aplicarla. Después de este arranque, el selector flotante
   * actualiza `previewPlantilla` + la URL directamente (ya post-hidratación, sin este cuidado).
   */
  private readPreviewParams(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const params = new URLSearchParams(location.search);

    const tpl = params.get('plantilla');
    const validTpl = tpl && /^[ABC]$/i.test(tpl) ? tpl.toUpperCase() : null;

    const color = params.get('color');
    if (color) {
      try {
        const decoded = decodeURIComponent(color);
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(decoded)) this.previewColor.set(decoded);
      } catch {
        // valor malformado (% suelto, etc.): ignoramos, previewColor queda null.
      }
    }

    return validTpl;
  }

  /** Los anchors de solo-fragmento se resuelven contra <base href="/"> y se llevan puesto el
   *  query string (rompe ?plantilla= de la preview). Scrolleamos a mano y dejamos la URL como está. */
  irA(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Click en el selector flotante A/B/C: cambia el preview en vivo y actualiza el query param
   *  (sin recargar) para que el link se pueda copiar tal cual se está viendo. */
  setPreviewPlantilla(tpl: string): void {
    this.previewPlantilla.set(tpl);
    if (!isPlatformBrowser(this.platformId)) return;
    const url = new URL(location.href);
    url.searchParams.set('plantilla', tpl);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  private loadConfig(): void {
    this.booking.config().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.applyBranding(cfg);
        this.applySeo(cfg);
        this.duracion.set(cfg.duracionDefault);
        this.initDefaultDay();
      },
      error: () => {
        this.duracion.set(90);
        this.initDefaultDay();
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar la configuración. Probá de nuevo.',
        });
      },
    });
  }

  /**
   * Aplica la colorimetría del tenant al :root: el color primario y sus derivados (deep/soft, con
   * color-mix). Así cada club sale con su propio color sin tocar los estilos. Solo en browser
   * (en SSR no hay document). El logo se resuelve aparte vía logoSrc().
   */
  private applyBranding(cfg: PublicConfig): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const root = document.documentElement.style;
    // El preview (`?color=`) pisa el color del tenant; ya viene validado por readPreviewParams().
    const color = (this.previewColor() ?? cfg.tenant.colorPrimario)?.trim();
    if (color) {
      root.setProperty('--court', color);
      root.setProperty('--court-deep', `color-mix(in srgb, ${color} 82%, #000)`);
      root.setProperty('--court-soft', `color-mix(in srgb, ${color} 12%, #fff)`);
      // M11: texto legible sobre el primario (chips/botones/afiche) si el club usa un color claro.
      root.setProperty('--ink-on-accent', inkOnAccent(color));
    }
    // Color secundario (acento; ej. el grip de la paleta). Si no hay, el CSS cae al primario.
    const colorSec = cfg.tenant.colorSecundario?.trim();
    if (colorSec) root.setProperty('--court-2', colorSec);
    else root.removeProperty('--court-2');
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

  /** Proba HOY/MAÑANA/PASADO con la duración elegida; arranca en el primero con disponibilidad. */
  private initDefaultDay(): void {
    const candidates = [this.today, addDays(this.today, 1), addDays(this.today, 2)];
    const dur = this.duracion();
    const probes$ = candidates.map((d) =>
      this.booking
        .disponibilidad(this.apiFecha(d), dur)
        .pipe(catchError(() => of([] as Slot[])))
    );
    forkJoin(probes$).subscribe((results) => {
      const idx = results.findIndex((slots) => slots.some((s) => s.disponible));
      const chosenIdx = idx !== -1 ? idx : 0;
      this.selectedDay.set(startOfDay(candidates[chosenIdx]));
      this.slots.set(results[chosenIdx]);
      this.slotsLoaded.set(true);
    });
  }

  // ── Paso 1 · Duración ─────────────────────────────────────────────
  pickDuracion(d: number): void {
    if (this.duracion() === d) return;
    this.duracion.set(d);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    const day = this.selectedDay();
    if (day) this.loadAvailability(day);
  }

  // ── Chips de día ──────────────────────────────────────────────────
  chipDate(d: Date): string {
    return `${d.getDate()} ${MES_ABBR[d.getMonth()].toUpperCase()}`;
  }
  isChipSelected(d: Date): boolean {
    return !this.calOpen() && sameDay(this.selectedDay(), d);
  }

  selectDay(date: Date): void {
    const day = startOfDay(date);
    this.selectedDay.set(day);
    this.calOpen.set(false);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.loadAvailability(day);
  }

  toggleCalendar(): void {
    const opening = !this.calOpen();
    this.calOpen.set(opening);
    if (opening) this.pickerValue.set(this.selectedDay() ?? this.today);
  }

  onPickerSelect(value: Date): void {
    if (!value) return;
    this.pickerValue.set(startOfDay(value));
    // selectDay cierra el calendario (que tapa los horarios) y recarga disponibilidad.
    this.selectDay(value);
  }

  // ── Disponibilidad ────────────────────────────────────────────────
  private apiFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private loadAvailability(day: Date): void {
    this.loadingSlots.set(true);
    this.slotsLoaded.set(false);
    this.slots.set([]);
    this.booking.disponibilidad(this.apiFecha(day), this.duracion()).subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
      },
      error: () => {
        this.slots.set([]);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar los turnos. Probá de nuevo.',
        });
      },
    });
  }

  selectTime(slot: Slot): void {
    if (!slot.disponible) return;
    this.selectedTime.set(slot.hora);
    // Con autoasignación no hay paso de cancha: dejamos "cualquiera" (ANY) elegido y pasamos a datos.
    this.selectedCancha.set(this.showCancha() ? null : this.ANY);
  }

  // ── Paso 4 · Cancha ───────────────────────────────────────────────
  selectCancha(id: number): void {
    this.selectedCancha.set(id);
  }
  isCanchaSelected(id: number): boolean {
    return this.selectedCancha() === id;
  }
  canchaTipo(c: CanchaLibre): string {
    const techo = c.techada ? 'Techada' : 'Descubierta';
    return c.tipoPared ? `${techo} · ${c.tipoPared}` : techo;
  }

  /** Etiqueta del material de la pared para la card de cancha (espeja tipoPared). */
  materialLabel(c: CanchaLibre): string {
    switch (c.tipoPared) {
      case 'MURO': return 'Hormigón';
      case 'MIXTA': return 'Mixta';
      case 'CRISTAL': return 'Vidrio';
      default: return c.tipoPared ?? 'Cancha';
    }
  }

  /** Precio total del turno (precio/hora × duración elegida), formateado con separador de miles. */
  precioTurno(c: CanchaLibre): string | null {
    if (c.precioHora == null) return null;
    const total = Math.round((c.precioHora * this.duracion()) / 60);
    return total.toLocaleString('es-AR');
  }

  // ── Confirmar ─────────────────────────────────────────────────────
  confirm(): void {
    if (!this.canConfirm()) return;
    const day = this.selectedDay();
    const hora = this.selectedTime();
    const canchaSel = this.selectedCancha();
    if (!day || !hora || canchaSel === null) return;

    const nombre = this.nombre().trim();
    const canchaId = canchaSel === this.ANY ? null : canchaSel;
    this.enviando.set(true);
    this.booking
      .crearReserva({
        complejoId: this.config()?.complejo.id,
        canchaId,
        fecha: this.apiFecha(day),
        hora,
        duracion: this.duracion(),
        clienteNombre: nombre,
        clienteWhatsapp: this.whatsapp().trim(),
        empresa: this.empresa(),
      })
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          this.successData.set({
            cancha: res.canchaNombre,
            dia: this.fmtRecapDay(day),
            hora: `${hora} hs`,
            duracion: this.duracion(),
            primerNombre: nombre.split(' ')[0],
            nombreCompleto: nombre,
            pendiente: res.estado === 'PENDIENTE',
            senaMonto: this.senaMontoFmt(),
            senaAlias: this.senaAlias(),
          });
          this.aliasCopiado.set(false);
          this.success.set(true);
          window.scrollTo(0, 0);

          this.senaInitPoint.set(null);
          if (res.estado === 'PENDIENTE' && this.config()?.pagoOnline) {
            this.booking.crearLinkSena(res.id, location.origin).subscribe({
              next: ({ initPoint }) => this.senaInitPoint.set(initPoint),
              error: () => this.senaInitPoint.set(null), // degrada al alias por transferencia
            });
          }
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          if (err.status === 409) {
            this.messages.add({
              severity: 'warn',
              summary: 'Horario ocupado',
              detail: 'Ese turno ya fue tomado, probá otro.',
            });
            this.selectedTime.set(null);
            this.selectedCancha.set(null);
            this.loadAvailability(day);
          } else if (err.status === 422 || err.status === 429) {
            this.messages.add({
              severity: 'warn',
              summary: 'No pudimos reservar',
              detail: err.error?.error ?? 'Probá más tarde o escribinos.',
            });
          } else {
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No pudimos confirmar el turno. Probá de nuevo.',
            });
          }
        },
      });
  }

  private fmtRecapDay(d: Date): string {
    return `${DOWS[d.getDay()]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  }

  /** Fecha compacta para el recap del turno antes de confirmar (M10), ej. "Vie 24/07". */
  private recapDay(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${DOW_ABBR[d.getDay()]} ${dd}/${mm}`;
  }

  backHome(): void {
    this.success.set(false);
    this.successData.set(null);
    this.senaInitPoint.set(null);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.nombre.set('');
    this.whatsapp.set('');
    this.calOpen.set(false);
    this.selectDay(this.today);
    window.scrollTo(0, 0);
  }

  // ── Botón de arrepentimiento (Res. 424/2020) ───────────────────────
  abrirArrepentimiento(): void {
    this.showArrep.set(true);
  }

  // ── Política de cancelación ─────────────────────────────────────────
  abrirPolitica(): void {
    this.showPolitica.set(true);
  }

  openMaps(): void {
    const url = this.mapaUrl();
    if (url) window.open(url, '_blank');
  }

  /** Copia el alias de la seña al portapapeles y muestra un feedback breve en el botón. */
  copyAlias(): void {
    const alias = this.successData()?.senaAlias;
    if (!alias) return;
    const ok = () => {
      this.aliasCopiado.set(true);
      this.messages.add({ severity: 'success', summary: 'Alias copiado', detail: alias });
      setTimeout(() => this.aliasCopiado.set(false), 1800);
    };
    const fail = () =>
      this.messages.add({
        severity: 'warn',
        summary: 'No se pudo copiar',
        detail: 'Copialo manualmente: ' + alias,
      });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(alias).then(ok, fail);
    } else {
      fail();
    }
  }
}

/**
 * Agrupa los horarios por franja en filas de display: por cada día (0..6 = Lun..Dom) el
 * span es min(inicio)–max(fin); días consecutivos con el mismo span se colapsan; sin
 * horario → "Cerrado".
 */
function groupHorarios(horarios: PublicConfig['horarios']): HoursRow[] {
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
