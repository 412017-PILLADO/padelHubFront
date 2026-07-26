import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { concatMap } from 'rxjs';

import {
  AgendaConfig,
  AgendaConfigService,
  BloqueoItem,
  DiaConfig,
  ReservaAfectada,
} from '../../../core/api/agenda-config.service';

/** Franja horaria de ajuste porcentual en edición: `tempId` es un id local (no viaja al back),
 *  necesario para trackear filas nuevas que todavía no tienen `id` del servidor. El signo se maneja
 *  con `tipo` (descuento/recargo) + `pct` positivo, que es como lo piensa el dueño; al guardar se
 *  convierte al `ajustePorcentaje` con signo del back. */
interface FranjaEdit {
  tempId: number;
  desde: string;
  hasta: string;
  tipo: 'DESCUENTO' | 'RECARGO';
  pct: number | null;
}
import { CanchaConfig } from '../../../core/api/booking.service';
import { AdminNavComponent } from '../admin-nav/admin-nav';
import { BrandingService } from '../../../core/branding/branding.service';
import { UnsavedChangesService } from '../unsaved-changes.service';
import { environment } from '../../../../environments/environment';
import { MpEstado, PagosService } from '../../../core/api/pagos.service';

/** Tipos de cerramiento de la cancha (espeja el enum TipoPared del backend). */
const TIPO_PARED_OPCIONES = [
  { label: 'Cristal', value: 'CRISTAL' },
  { label: 'Muro', value: 'MURO' },
  { label: 'Mixta', value: 'MIXTA' },
];

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

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DOW_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MES_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Opciones de duración ofrecidas como chips (se puede activar/desactivar). */
const DURACION_OPCIONES = [30, 45, 60, 75, 90, 120];

function timeOptions(): string[] {
  const arr: string[] = [];
  for (let m = 7 * 60; m <= 24 * 60; m += 30) {
    const h = String(Math.floor(m / 60) % 24).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    arr.push(`${h}:${mm}`);
  }
  return arr;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHhmm(m: number): string {
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

@Component({
  selector: 'app-admin-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AdminNavComponent,
    DatePickerModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export class ConfigComponent {
  private readonly api = inject(AgendaConfigService);
  private readonly pagosService = inject(PagosService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly primeng = inject(PrimeNG);
  private readonly branding = inject(BrandingService);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly times = timeOptions();
  readonly dowLabels = DOW;
  readonly dowFull = DOW_FULL;
  readonly durOpciones = DURACION_OPCIONES;
  readonly tipoParedOpciones = TIPO_PARED_OPCIONES;
  readonly today = startOfDay(new Date());

  // ── Marca (color primario + secundario + logo del club) ──
  readonly marcaColor = signal('#0a8a99');
  /** Color secundario (acento). null = sin definir → se usa el primario. */
  readonly marcaColorSec = signal<string | null>(null);
  /** Valor para el <input type=color> del secundario (no acepta null): cae al primario si no hay. */
  readonly marcaColorSecPicker = computed(() => this.marcaColorSec() ?? this.marcaColor());
  /** Plantilla de landing elegida por el club (A poster / B hero / C compacta). */
  readonly marcaPlantilla = signal('A');
  readonly plantillas = [
    { value: 'A', label: 'A · Poster', hint: 'Afiche a un lado + reserva' },
    { value: 'B', label: 'B · Hero centrado', hint: 'Marca grande centrada, más comercial' },
    { value: 'C', label: 'C · Compacta (app)', hint: 'Barra lateral + grilla, directo a reservar' },
  ];
  readonly marcaLogoUrl = signal<string | null>(null);
  readonly savingMarca = signal(false);
  readonly uploadingLogo = signal(false);
  /** Cambia tras subir/quitar el logo para bustear la caché del <img> de preview. */
  private readonly logoBust = signal(0);
  /** URL absoluta del logo para la preview (con cache-bust), o null si no hay logo. */
  readonly logoPreview = computed(() => {
    const u = this.marcaLogoUrl();
    if (!u) return null;
    const abs = /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
    return abs + (abs.includes('?') ? '&' : '?') + 'v=' + this.logoBust();
  });

  // ── Horario semanal (index 0=Lun … 6=Dom) ──
  readonly week = signal<DiaConfig[]>([]);

  // ── Descanso ──
  readonly breakOn = signal(false);
  readonly breakFrom = signal('13:00');
  readonly breakTo = signal('14:00');

  // ── Duraciones ──
  readonly pasoMinutos = signal(30);
  readonly duraciones = signal<number[]>([60, 90, 120]);
  /** Turno principal: ancla la grilla de horarios y es el único turno si no se permiten otros. */
  readonly duracionDefault = signal(90);
  readonly permitirOtras = signal(true);

  // ── Precios ──
  readonly precioModo = signal<'GENERAL' | 'POR_CANCHA'>('POR_CANCHA');
  readonly precioHoraGeneral = signal<number | null>(null);

  // ── Precio por horario (franjas) ──
  readonly precioFranjas = signal<FranjaEdit[]>([]);
  private franjaSeq = 0;

  // ── Seña ──
  readonly requiereSena = signal(false);
  readonly senaMonto = signal<number | null>(null);
  readonly senaAlias = signal<string | null>(null);
  readonly politicaCancelacion = signal<string | null>(null);

  // ── Mercado Pago ──
  readonly mpEstado = signal<MpEstado | null>(null);
  readonly mpBusy = signal(false);

  // ── Autoasignación de canchas ──
  readonly autoasignacion = signal(false);

  // ── Canchas ──
  readonly canchas = signal<CanchaConfig[]>([]);
  /** id de la cancha en edición; null = formulario de alta. */
  readonly editingCanchaId = signal<number | null>(null);
  readonly canchaFormOpen = signal(false);
  readonly cNombre = signal('');
  readonly cOrden = signal<number | null>(null);
  readonly cTechada = signal(false);
  readonly cTipoPared = signal('CRISTAL');
  readonly cPrecio = signal<number | null>(null);
  readonly cColor = signal('#0a8a99');
  /** Estado de la cancha en edición ('ACTIVO'/'INACTIVO'); se preserva al editar, no se pisa. */
  readonly cEstado = signal('ACTIVO');
  readonly canchaSaving = signal(false);
  /** id de cancha con el toggle activar/desactivar en curso (deshabilita el botón mientras pega al back). */
  readonly canchaTogglingId = signal<number | null>(null);

  readonly canchasOrdenadas = computed(() =>
    [...this.canchas()].sort((a, b) => a.orden - b.orden)
  );
  readonly canCanchaSave = computed(
    () => this.cNombre().trim().length > 0 && !this.canchaSaving()
  );
  /** Canchas activas sin precio cargado (sólo aplica en modo POR_CANCHA): el público no ve precio en esos turnos. */
  readonly canchasSinPrecio = computed(() => {
    if (this.precioModo() !== 'POR_CANCHA') return [];
    return this.canchas().filter((c) => c.estado === 'ACTIVO' && c.precioHora == null);
  });

  // ── Bloqueos ──
  readonly bloqueos = signal<BloqueoItem[]>([]);
  readonly calValue = signal<Date | null>(null);
  /** null = todo el complejo. */
  readonly bloqueoCanchaId = signal<number | null>(null);
  readonly bloqueoMotivo = signal('');

  /** Reservas que quedaron fuera del horario recién guardado o dentro de un bloqueo recién creado. */
  readonly reservasAfectadas = signal<ReservaAfectada[]>([]);

  readonly canchaOpciones = computed(() => [
    { label: 'Todo el complejo', value: null as number | null },
    ...this.canchas().map((c) => ({ label: c.nombre, value: c.id as number | null })),
  ]);

  // ── Contacto ──
  readonly direccion = signal('');
  readonly telefono = signal('');
  readonly whatsapp = signal('');
  readonly mapaUrl = signal('');
  readonly instagram = signal('');

  // ── Estado ──
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly loaded = signal(false);

  readonly invalidPaso = computed(() => {
    const n = this.pasoMinutos();
    return !(Number.isFinite(n) && n >= 5 && n <= 180);
  });
  readonly invalidDuraciones = computed(
    () => this.duraciones().length === 0 || !this.duraciones().includes(this.duracionDefault())
  );
  readonly invalidPrecio = computed(() => {
    if (this.precioModo() !== 'GENERAL') return false;
    const p = this.precioHoraGeneral();
    return p == null || !(p > 0);
  });
  /** Mensaje del primer problema en las franjas de precio por horario (espeja las validaciones
   *  del back: ajuste != 0 en rango, desde < hasta con medianoche, sin solapes). null si está OK. */
  readonly precioFranjasError = computed<string | null>(() => {
    const franjas = this.precioFranjas();
    for (const f of franjas) {
      if (f.pct == null || !(f.pct > 0)) {
        return 'Cargá el porcentaje en todas las franjas horarias (mayor a 0)';
      }
      if (f.tipo === 'DESCUENTO' && f.pct > 99) {
        return 'El descuento máximo es 99% (a 100% el turno saldría gratis)';
      }
      if (f.tipo === 'RECARGO' && f.pct > 300) {
        return 'El recargo máximo es 300%';
      }
    }
    for (const f of franjas) {
      if (f.hasta !== '00:00' && f.desde >= f.hasta) {
        return 'En cada franja horaria, el desde debe ser antes del hasta';
      }
    }
    const rangos = franjas.map((f) => ({
      from: hhmmToMin(f.desde),
      to: f.hasta === '00:00' ? 24 * 60 : hhmmToMin(f.hasta),
    }));
    for (let i = 0; i < rangos.length; i++) {
      for (let j = i + 1; j < rangos.length; j++) {
        if (rangos[i].from < rangos[j].to && rangos[j].from < rangos[i].to) {
          return 'Hay franjas horarias que se superponen';
        }
      }
    }
    return null;
  });
  readonly invalidPrecioFranjas = computed(() => this.precioFranjasError() !== null);
  readonly invalidSenaMonto = computed(() => {
    if (!this.requiereSena()) return false;
    const m = this.senaMonto();
    return m == null || !(m > 0);
  });
  readonly invalidSenaAlias = computed(() => {
    if (!this.requiereSena()) return false;
    const a = this.senaAlias();
    return a == null || a.trim().length === 0;
  });
  readonly invalidSena = computed(() => this.invalidSenaMonto() || this.invalidSenaAlias());
  /** Algún día abierto con apertura ≥ cierre (las horas "HH:mm" comparan bien como strings).
   *  Caso especial: cierre "00:00" significa medianoche (24:00), siempre después de cualquier apertura. */
  readonly invalidHorario = computed(() =>
    this.week().some((d) => d.open && d.to !== '00:00' && d.from >= d.to)
  );
  /** Descanso activo con inicio ≥ fin. */
  readonly invalidBreak = computed(() => this.breakOn() && this.breakFrom() >= this.breakTo());
  readonly canSave = computed(
    () => this.dirty() && !this.invalidPaso() && !this.invalidDuraciones()
      && !this.invalidHorario() && !this.invalidBreak()
      && !this.invalidPrecio() && !this.invalidPrecioFranjas() && !this.invalidSena() && !this.saving()
  );
  readonly saveState = computed(() => {
    if (this.invalidHorario()) return 'Revisá el horario: la apertura debe ser antes del cierre';
    if (this.invalidBreak()) return 'Revisá el descanso: el inicio debe ser antes del fin';
    if (this.invalidPaso()) return 'Revisá el paso (5–180 min)';
    if (this.invalidDuraciones()) return 'Elegí el turno principal';
    if (this.invalidPrecio()) return 'Cargá el precio general por hora';
    if (this.invalidPrecioFranjas()) return this.precioFranjasError() ?? 'Revisá el precio por horario';
    if (this.invalidSenaMonto()) return 'Cargá el monto de la seña';
    if (this.invalidSenaAlias()) return 'Cargá el alias de la seña';
    return this.dirty() ? 'Cambios sin guardar' : 'Todo guardado';
  });
  readonly breakStateLabel = computed(() =>
    this.breakOn() ? `${this.breakFrom()} — ${this.breakTo()}` : 'Sin pausa'
  );
  /** Aviso informativo (no bloqueante) por día: si la franja abierta no es múltiplo del turno
   *  principal, el resto al final del día queda sin poder reservarse. */
  readonly horarioAvisos = computed(() => {
    const dur = this.duracionDefault();
    if (!(dur > 0)) return [];
    const out: string[] = [];
    for (const d of this.week()) {
      if (!d.open || (d.to !== '00:00' && d.from >= d.to)) continue;
      const fromMin = hhmmToMin(d.from);
      const toMin = d.to === '00:00' ? 24 * 60 : hhmmToMin(d.to);
      const total = toMin - fromMin;
      const resto = total % dur;
      if (resto > 0) {
        const desde = minToHhmm(toMin - resto);
        const hasta = minToHhmm(toMin);
        out.push(`El horario de ${this.dowFull[d.diaSemana]} termina ${desde}–${hasta}: los últimos ${resto} min no se podrán reservar.`);
      }
    }
    return out;
  });
  readonly bloqueosOrdenados = computed(() =>
    [...this.bloqueos()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  );

  /** JS weekday index (0=Dom..6=Sáb) de los días cerrados. */
  readonly disabledDays = computed(() => {
    const out: number[] = [];
    for (const d of this.week()) {
      if (!d.open) out.push((d.diaSemana + 1) % 7);
    }
    return out;
  });

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    this.loadConfig();
    this.loadMarca();
    this.loadMpEstado();

    // Cambios sin guardar: si el usuario cierra/recarga la pestaña, avisar antes de perderlos.
    // Sólo en browser (SSR no tiene window) y se limpia al destruir el componente.
    if (isPlatformBrowser(this.platformId)) {
      const onBeforeUnload = (e: BeforeUnloadEvent): void => {
        if (!this.dirty()) return;
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('beforeunload', onBeforeUnload);
        this.unsaved.setDirty(false);
      });

      // Retorno del flujo OAuth: MP redirige acá con /admin/config?mp=conectado.
      if (new URLSearchParams(location.search).get('mp') === 'conectado') {
        this.messages.add({ severity: 'success', summary: 'Mercado Pago conectado', detail: 'La cuenta del club quedó vinculada.' });
        history.replaceState(null, '', location.pathname);
        this.loadMpEstado();
      }
    }
  }

  private loadMpEstado(): void {
    this.pagosService.getMpEstado().subscribe({
      next: (e) => this.mpEstado.set(e),
      error: () => this.mpEstado.set({ conectado: false, mpUserId: null, expiraEn: null }),
    });
  }

  private loadMarca(): void {
    this.api.getMarca().subscribe({
      next: (m) => {
        if (m.colorPrimario) this.marcaColor.set(m.colorPrimario);
        this.marcaColorSec.set(m.colorSecundario);
        if (m.plantilla) this.marcaPlantilla.set(m.plantilla);
        this.marcaLogoUrl.set(m.logoUrl);
      },
      error: () => {
        /* la marca es secundaria: si falla, el resto del panel sigue funcionando. */
      },
    });
  }

  /** Fija el color secundario (acento) desde el picker/hex. */
  setColorSec(v: string): void {
    this.marcaColorSec.set(v && v.trim() ? v.trim() : null);
  }

  /** Quita el color secundario: vuelve a usarse el primario para los acentos. */
  clearColorSec(): void {
    this.marcaColorSec.set(null);
  }

  /** Guarda los colores (primario + secundario) del club. Aplican a acentos de la página y el panel. */
  saveMarca(): void {
    const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
    const color = this.marcaColor().trim();
    if (!hex.test(color)) {
      this.messages.add({ severity: 'warn', summary: 'Color inválido', detail: 'Usá un hex como #0a8a99.' });
      return;
    }
    const colorSec = this.marcaColorSec()?.trim() || null;
    if (colorSec && !hex.test(colorSec)) {
      this.messages.add({ severity: 'warn', summary: 'Secundario inválido', detail: 'Usá un hex como #0a8a99.' });
      return;
    }
    this.savingMarca.set(true);
    this.api.putMarca({ colorPrimario: color, colorSecundario: colorSec, plantilla: this.marcaPlantilla() }).subscribe({
      next: (m) => {
        this.savingMarca.set(false);
        if (m.colorPrimario) this.marcaColor.set(m.colorPrimario);
        this.marcaColorSec.set(m.colorSecundario);
        if (m.plantilla) this.marcaPlantilla.set(m.plantilla);
        // Aplicar en vivo: recolorea el panel (nav/acentos) sin recargar.
        this.branding.apply(m.colorPrimario, m.colorSecundario, this.marcaLogoUrl());
        this.messages.add({ severity: 'success', summary: 'Guardado', detail: 'Marca actualizada' });
      },
      error: () => {
        this.savingMarca.set(false);
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos guardar los colores.' });
      },
    });
  }

  /** Sube el logo elegido en el input file. Valida tipo/tamaño antes de mandar. */
  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    const okTipo = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type);
    if (!okTipo) {
      this.messages.add({ severity: 'warn', summary: 'Formato no soportado', detail: 'Usá PNG, JPG, WEBP o SVG.' });
      return;
    }
    if (file.size > 512 * 1024) {
      this.messages.add({ severity: 'warn', summary: 'Muy pesado', detail: 'El logo debe pesar menos de 512 KB.' });
      return;
    }
    this.uploadingLogo.set(true);
    this.api.uploadLogo(file).subscribe({
      next: (m) => {
        this.uploadingLogo.set(false);
        this.marcaLogoUrl.set(m.logoUrl);
        this.logoBust.update((n) => n + 1);
        // Refleja el logo nuevo en la nav del panel al instante.
        this.branding.apply(this.marcaColor(), this.marcaColorSec(), m.logoUrl);
        this.messages.add({ severity: 'success', summary: 'Logo actualizado', detail: 'Ya se ve en tu página.' });
      },
      error: () => {
        this.uploadingLogo.set(false);
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos subir el logo.' });
      },
    });
  }

  /** Quita el logo del club (vuelve a mostrarse solo el nombre). */
  removeLogo(): void {
    this.uploadingLogo.set(true);
    this.api.deleteLogo().subscribe({
      next: (m) => {
        this.uploadingLogo.set(false);
        this.marcaLogoUrl.set(m.logoUrl);
        this.logoBust.update((n) => n + 1);
        // Vuelve a mostrar el ícono/nombre por defecto en la nav.
        this.branding.apply(this.marcaColor(), this.marcaColorSec(), m.logoUrl);
        this.messages.add({ severity: 'success', summary: 'Logo quitado', detail: 'Se muestra solo el nombre.' });
      },
      error: () => {
        this.uploadingLogo.set(false);
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos quitar el logo.' });
      },
    });
  }

  private loadConfig(): void {
    this.api.getConfig().subscribe({
      next: (cfg) => this.applyConfig(cfg),
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar la configuración. Probá de nuevo.',
        });
      },
    });
  }

  private applyConfig(cfg: AgendaConfig): void {
    const byDay = new Map(cfg.week.map((d) => [d.diaSemana, d]));
    const week: DiaConfig[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(byDay.get(i) ?? { diaSemana: i, open: false, from: '09:00', to: '23:00' });
    }
    this.week.set(week);
    this.breakOn.set(cfg.breakOn);
    this.breakFrom.set(cfg.breakFrom || '13:00');
    this.breakTo.set(cfg.breakTo || '14:00');
    this.pasoMinutos.set(cfg.pasoMinutos);
    this.duraciones.set([...cfg.duraciones].sort((a, b) => a - b));
    this.duracionDefault.set(cfg.duracionDefault);
    this.permitirOtras.set(cfg.permitirOtrasDuraciones ?? true);
    this.precioModo.set(cfg.precioModo ?? 'POR_CANCHA');
    this.precioHoraGeneral.set(cfg.precioHoraGeneral ?? null);
    this.precioFranjas.set(
      (cfg.precioFranjas ?? []).map((f) => ({
        tempId: ++this.franjaSeq,
        desde: f.desde,
        hasta: f.hasta,
        tipo: (f.ajustePorcentaje < 0 ? 'DESCUENTO' : 'RECARGO') as FranjaEdit['tipo'],
        pct: Math.abs(f.ajustePorcentaje),
      }))
    );
    this.requiereSena.set(cfg.requiereSena ?? false);
    this.senaMonto.set(cfg.senaMonto ?? null);
    this.senaAlias.set(cfg.senaAlias ?? null);
    this.politicaCancelacion.set(cfg.politicaCancelacion ?? null);
    this.autoasignacion.set(cfg.autoasignacion ?? false);
    this.bloqueos.set(cfg.bloqueos ?? []);
    this.canchas.set(cfg.canchas ?? []);
    const c = cfg.contacto ?? {
      direccion: null, telefono: null, whatsapp: null, mapaUrl: null, instagram: null,
    };
    this.direccion.set(c.direccion ?? '');
    this.telefono.set(c.telefono ?? '');
    this.whatsapp.set(c.whatsapp ?? '');
    this.mapaUrl.set(c.mapaUrl ?? '');
    this.instagram.set(c.instagram ?? '');
    this.dirty.set(false);
    this.unsaved.setDirty(false);
    this.loaded.set(true);
  }

  // ── Horario ──
  /** Etiqueta de una hora en el select de cierre: aclara que "00:00" es medianoche (24:00). */
  timeLabel(t: string): string {
    return t === '00:00' ? '00:00 (medianoche)' : t;
  }
  toggleDay(i: number): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], open: !next[i].open };
      return next;
    });
    this.markDirty();
  }
  setFrom(i: number, value: string): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], from: value };
      return next;
    });
    this.markDirty();
  }
  setTo(i: number, value: string): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], to: value };
      return next;
    });
    this.markDirty();
  }

  // ── Descanso ──
  toggleBreak(): void { this.breakOn.update((v) => !v); this.markDirty(); }
  setBreakFrom(v: string): void { this.breakFrom.set(v); this.markDirty(); }
  setBreakTo(v: string): void { this.breakTo.set(v); this.markDirty(); }

  // ── Contacto ──
  setDireccion(v: string): void { this.direccion.set(v); this.markDirty(); }
  setTelefono(v: string): void { this.telefono.set(v); this.markDirty(); }
  setWhatsapp(v: string): void { this.whatsapp.set(v); this.markDirty(); }
  setMapaUrl(v: string): void { this.mapaUrl.set(v); this.markDirty(); }
  setInstagram(v: string): void { this.instagram.set(v); this.markDirty(); }

  // ── Duraciones ──
  isDurActive(d: number): boolean { return this.duraciones().includes(d); }
  toggleDur(d: number): void {
    // El turno principal no se puede desactivar (siempre tiene que ser reservable).
    if (d === this.duracionDefault()) return;
    this.duraciones.update((list) =>
      list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort((a, b) => a - b)
    );
    this.markDirty();
  }
  setDefault(d: number): void {
    this.duracionDefault.set(d);
    // El turno principal siempre tiene que estar entre las duraciones permitidas.
    if (!this.duraciones().includes(d)) {
      this.duraciones.update((list) => [...list, d].sort((a, b) => a - b));
    }
    this.markDirty();
  }
  togglePermitirOtras(): void { this.permitirOtras.update((v) => !v); this.markDirty(); }
  onPasoInput(value: string): void {
    const n = Number(value);
    this.pasoMinutos.set(Number.isFinite(n) ? Math.round(n) : 0);
    this.markDirty();
  }

  // ── Precios ──
  setPrecioModo(modo: 'GENERAL' | 'POR_CANCHA'): void { this.precioModo.set(modo); this.markDirty(); }
  // El input es type="number": ngModelChange emite number | null (NumberValueAccessor), no string.
  onPrecioGeneralInput(value: number | null): void {
    this.precioHoraGeneral.set(value == null || !Number.isFinite(value) ? null : Math.round(value));
    this.markDirty();
  }

  // ── Precio por horario (franjas) ──
  addFranja(): void {
    this.precioFranjas.update((list) => [
      ...list,
      { tempId: ++this.franjaSeq, desde: '15:00', hasta: '18:00', tipo: 'DESCUENTO' as const, pct: null },
    ]);
    this.markDirty();
  }
  removeFranja(tempId: number): void {
    this.precioFranjas.update((list) => list.filter((f) => f.tempId !== tempId));
    this.markDirty();
  }
  setFranjaDesde(tempId: number, value: string): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, desde: value } : f))
    );
    this.markDirty();
  }
  setFranjaHasta(tempId: number, value: string): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, hasta: value } : f))
    );
    this.markDirty();
  }
  setFranjaTipo(tempId: number, tipo: FranjaEdit['tipo']): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, tipo } : f))
    );
    this.markDirty();
  }
  // El input es type="number": ngModelChange emite number | null (NumberValueAccessor), no string.
  onFranjaPctInput(tempId: number, value: number | null): void {
    const pct = value == null || !Number.isFinite(value) ? null : Math.abs(Math.round(value));
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, pct } : f))
    );
    this.markDirty();
  }

  // ── Seña ──
  toggleSena(): void { this.requiereSena.update((v) => !v); this.markDirty(); }
  onSenaMontoInput(value: number | null): void {
    this.senaMonto.set(value == null || !Number.isFinite(value) ? null : Math.round(value));
    this.markDirty();
  }
  onSenaAliasInput(value: string): void {
    this.senaAlias.set(value.trim() === '' ? null : value);
    this.markDirty();
  }
  onPoliticaCancelacionInput(value: string): void {
    this.politicaCancelacion.set(value.trim() === '' ? null : value);
    this.markDirty();
  }

  // ── Autoasignación ──
  toggleAutoasignacion(): void { this.autoasignacion.update((v) => !v); this.markDirty(); }

  // ── Mercado Pago ──
  conectarMp(): void {
    this.mpBusy.set(true);
    const returnTo = location.origin + '/admin/config';
    this.pagosService.conectarMp(returnTo).subscribe({
      next: ({ url }) => (location.href = url),
      error: (err: HttpErrorResponse) => {
        this.mpBusy.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Mercado Pago',
          detail: err?.error?.error ?? 'No se pudo iniciar la conexión.',
        });
      },
    });
  }

  desconectarMp(): void {
    this.confirm.confirm({
      header: 'Desconectar Mercado Pago',
      message: '¿Desconectar Mercado Pago? Las señas dejarán de cobrarse online.',
      acceptLabel: 'Desconectar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.pagosService.desconectarMp().subscribe(() => {
          this.mpEstado.set({ conectado: false, mpUserId: null, expiraEn: null });
          this.messages.add({ severity: 'success', summary: 'Mercado Pago', detail: 'Cuenta desvinculada.' });
        });
      },
    });
  }

  // ── Canchas ──
  startNewCancha(): void {
    this.editingCanchaId.set(null);
    this.cNombre.set('');
    this.cOrden.set(null);
    this.cTechada.set(false);
    this.cTipoPared.set('CRISTAL');
    this.cPrecio.set(null);
    this.cColor.set('#0a8a99');
    this.cEstado.set('ACTIVO');
    this.canchaFormOpen.set(true);
  }

  editCancha(c: CanchaConfig): void {
    this.editingCanchaId.set(c.id);
    this.cNombre.set(c.nombre);
    this.cOrden.set(c.orden);
    this.cTechada.set(c.techada);
    this.cTipoPared.set(c.tipoPared ?? 'CRISTAL');
    this.cPrecio.set(c.precioHora);
    this.cColor.set(c.color ?? '#0a8a99');
    this.cEstado.set(c.estado || 'ACTIVO');
    this.canchaFormOpen.set(true);
  }

  cancelCanchaEdit(): void {
    this.canchaFormOpen.set(false);
    this.editingCanchaId.set(null);
  }

  saveCancha(): void {
    if (!this.canCanchaSave()) return;
    this.canchaSaving.set(true);
    const nombre = this.cNombre().trim();
    const orden = this.cOrden();
    const techada = this.cTechada();
    const tipoPared = this.cTipoPared();
    const precioHora = this.cPrecio();
    const color = this.cColor()?.trim() || null;
    const editingId = this.editingCanchaId();

    const done = (saved: CanchaConfig, verbo: string) => {
      this.canchas.update((list) => {
        const idx = list.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = saved;
          return next;
        }
        return [...list, saved];
      });
      this.canchaSaving.set(false);
      this.canchaFormOpen.set(false);
      this.editingCanchaId.set(null);
      this.messages.add({ severity: 'success', summary: verbo, detail: saved.nombre });
    };
    const fail = () => {
      this.canchaSaving.set(false);
      this.messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No pudimos guardar la cancha. Probá de nuevo.',
      });
    };

    if (editingId == null) {
      this.api.postCancha({ nombre, orden, techada, tipoPared, precioHora, color }).subscribe({
        next: (saved) => done(saved, 'Cancha creada'),
        error: fail,
      });
    } else {
      // Nunca hardcodeamos el estado acá: se manda el que ya tenía la cancha (el toggle
      // activar/desactivar es un flujo aparte, ver `toggleCanchaEstado`).
      this.api
        .putCancha(editingId, { nombre, orden, techada, tipoPared, precioHora, color, estado: this.cEstado() })
        .subscribe({ next: (saved) => done(saved, 'Cancha actualizada'), error: fail });
    }
  }

  /** Activa/desactiva una cancha. Al desactivar, pide confirmación (deja de ofrecerse, no borra reservas). */
  toggleCanchaEstado(c: CanchaConfig): void {
    const activando = c.estado !== 'ACTIVO';
    if (!activando) {
      this.confirm.confirm({
        header: 'Desactivar cancha',
        message: `¿Desactivar "${c.nombre}"? Deja de ofrecerse al público para reservar; las reservas ya hechas se conservan.`,
        acceptLabel: 'Desactivar',
        rejectLabel: 'Volver',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => this.doToggleCanchaEstado(c, 'INACTIVO'),
      });
    } else {
      this.doToggleCanchaEstado(c, 'ACTIVO');
    }
  }

  private doToggleCanchaEstado(c: CanchaConfig, estado: string): void {
    this.canchaTogglingId.set(c.id);
    this.api
      .putCancha(c.id, {
        nombre: c.nombre,
        orden: c.orden,
        techada: c.techada,
        tipoPared: c.tipoPared ?? 'CRISTAL',
        precioHora: c.precioHora,
        color: c.color,
        estado,
      })
      .subscribe({
        next: (saved) => {
          this.canchaTogglingId.set(null);
          this.canchas.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
          this.messages.add({
            severity: 'success',
            summary: estado === 'ACTIVO' ? 'Activada' : 'Desactivada',
            detail: c.nombre,
          });
        },
        error: () => {
          this.canchaTogglingId.set(null);
          this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No pudimos cambiar el estado de la cancha. Probá de nuevo.',
          });
        },
      });
  }

  askDeleteCancha(c: CanchaConfig): void {
    this.confirm.confirm({
      header: 'Eliminar cancha',
      message: `¿Eliminar la cancha "${c.nombre}"? Las reservas ya hechas se conservan.`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDeleteCancha(c),
    });
  }

  private doDeleteCancha(c: CanchaConfig): void {
    this.api.deleteCancha(c.id).subscribe({
      next: () => {
        this.canchas.update((list) => list.filter((x) => x.id !== c.id));
        // Si estaba seleccionada como destino de un bloqueo, resetear a "todo el complejo".
        if (this.bloqueoCanchaId() === c.id) this.bloqueoCanchaId.set(null);
        if (this.editingCanchaId() === c.id) this.cancelCanchaEdit();
        this.messages.add({ severity: 'success', summary: 'Eliminada', detail: c.nombre });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos eliminar la cancha. Probá de nuevo.',
        });
      },
    });
  }

  tipoParedLabel(value: string | null): string {
    return this.tipoParedOpciones.find((o) => o.value === value)?.label ?? (value ?? '—');
  }

  // ── Bloqueos ──
  setBloqueoCancha(v: number | null): void { this.bloqueoCanchaId.set(v); }
  setBloqueoMotivo(v: string): void { this.bloqueoMotivo.set(v); }

  onPickerSelect(value: Date): void {
    if (!value) return;
    const fecha = ymd(startOfDay(value));
    this.calValue.set(null);
    const canchaId = this.bloqueoCanchaId();
    const canchaLabel = this.canchaOpciones().find((o) => o.value === canchaId)?.label ?? 'todo el complejo';
    this.confirm.confirm({
      header: 'Bloquear día',
      message: `¿Bloquear el ${this.fechaLarga(fecha)} para ${canchaLabel}?`,
      acceptLabel: 'Bloquear',
      rejectLabel: 'Volver',
      accept: () => this.doCrearBloqueo(fecha, canchaId),
    });
  }

  private doCrearBloqueo(fecha: string, canchaId: number | null): void {
    const motivo = this.bloqueoMotivo().trim() || null;
    this.api.postBloqueo({ fecha, canchaId, motivo }).subscribe({
      next: (created) => {
        this.bloqueos.update((list) => [...list, created]);
        this.bloqueoMotivo.set('');
        this.reservasAfectadas.set(created.reservasAfectadas ?? []);
        this.messages.add({ severity: 'success', summary: 'Bloqueado', detail: this.fechaLarga(fecha) });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos bloquear ese día. Probá de nuevo.',
        });
      },
    });
  }

  dismissReservasAfectadas(): void {
    this.reservasAfectadas.set([]);
  }

  removeBloqueo(b: BloqueoItem): void {
    this.api.deleteBloqueo(b.id).subscribe({
      next: () => {
        this.bloqueos.update((list) => list.filter((x) => x.id !== b.id));
        this.messages.add({ severity: 'success', summary: 'Liberado', detail: this.fechaLarga(b.fecha) });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos liberar ese día. Probá de nuevo.',
        });
      },
    });
  }

  bloqDayNum(b: BloqueoItem): string {
    const d = parseYmd(b.fecha);
    return `${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  }
  bloqDow(b: BloqueoItem): string {
    const d = parseYmd(b.fecha);
    return DOW_FULL[(d.getDay() + 6) % 7];
  }
  private fechaLarga(fecha: string): string {
    const d = parseYmd(fecha);
    return `${DOW_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  }

  // ── Guardar ──
  private markDirty(): void {
    this.dirty.set(true);
    this.unsaved.setDirty(true);
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    const norm = (v: string): string | null => v.trim() || null;
    const contacto = {
      direccion: norm(this.direccion()),
      telefono: norm(this.telefono()),
      whatsapp: norm(this.whatsapp()),
      mapaUrl: norm(this.mapaUrl()),
      instagram: norm(this.instagram()),
    };

    // Nombre de la sección que se está guardando en cada paso: se usa para señalar en el
    // toast de error cuál PUT falló (los pasos son secuenciales, así que en el momento del
    // error `seccion` siempre refleja el que está en curso).
    let seccion = 'Horario';

    this.api
      .putHorarios({
        breakOn: this.breakOn(),
        breakFrom: this.breakFrom(),
        breakTo: this.breakTo(),
        week: this.week(),
      })
      .pipe(
        concatMap((res) => {
          this.reservasAfectadas.set(res.reservasAfectadas ?? []);
          seccion = 'Duraciones';
          return this.api.putDuraciones({
            pasoMinutos: this.pasoMinutos(),
            duraciones: this.duraciones(),
            duracionDefault: this.duracionDefault(),
            permitirOtrasDuraciones: this.permitirOtras(),
          });
        }),
        concatMap(() => {
          seccion = 'Precios';
          // Mandamos siempre lo que hay cargado en el form (aunque el modo activo sea otro):
          // el back preserva el valor, así no se pisa lo que el usuario ya cargó si vuelve a cambiar de modo.
          return this.api.putPrecios({
            precioModo: this.precioModo(),
            precioHoraGeneral: this.precioHoraGeneral(),
          });
        }),
        concatMap(() => {
          seccion = 'Precio por horario';
          return this.api.putPrecioFranjas({
            franjas: this.precioFranjas().map((f) => ({
              desde: f.desde,
              hasta: f.hasta,
              ajustePorcentaje: f.tipo === 'DESCUENTO' ? -(f.pct as number) : (f.pct as number),
            })),
          });
        }),
        concatMap(() => {
          seccion = 'Seña';
          return this.api.putSena({
            requiereSena: this.requiereSena(),
            senaMonto: this.senaMonto(),
            senaAlias: this.senaAlias(),
          });
        }),
        concatMap(() => {
          seccion = 'Política de cancelación';
          return this.api.putPoliticaCancelacion(this.politicaCancelacion());
        }),
        concatMap(() => {
          seccion = 'Elección de cancha';
          return this.api.putAutoasignacion({ autoasignacion: this.autoasignacion() });
        }),
        concatMap(() => {
          seccion = 'Contacto';
          return this.api.putContacto(contacto);
        })
      )
      .subscribe({
        next: (cfg) => {
          this.applyConfig(cfg);
          this.saving.set(false);
          this.messages.add({ severity: 'success', summary: 'Guardado', detail: 'Cambios guardados' });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          // Son varios PUT encadenados y NO son atómicos: si falla uno del medio, los anteriores
          // ya se persistieron. Recargamos del server para que la UI muestre el estado real
          // (y no quede el front creyendo que no se guardó nada mientras parte ya está en vivo).
          const backendMsg: string | undefined = err?.error?.error;
          this.messages.add({
            severity: 'warn',
            summary: 'Guardado incompleto',
            detail: backendMsg
              ? `${seccion}: ${backendMsg}`
              : 'Puede que algunos cambios no se hayan aplicado. Recargamos la configuración para mostrarte el estado real.',
          });
          this.loadConfig();
        },
      });
  }
}
