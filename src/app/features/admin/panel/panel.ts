import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { Arrepentimiento, Pendiente, SlotLibre, Turno, TurnosService } from '../../../core/api/turnos.service';
import { AgendaConfig, AgendaConfigService } from '../../../core/api/agenda-config.service';
import { WhatsappArPipe } from '../../../shared/whatsapp-ar.pipe';
import { AdminNavComponent } from '../admin-nav/admin-nav';

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

const DOWS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

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
/** Minúsculas y sin acentos, para que el buscador matchee "jose" con "José". */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Un bloque de turno ubicado en la grilla (columna = cancha, fila = franja horaria). */
interface GridBlock {
  col: number;
  rowStart: number;
  rowSpan: number;
  turno: Turno;
}
/** Una columna de la grilla. `activa:false` = la cancha ya no se ofrece (inactiva o dada de baja)
 *  pero tiene turnos ese día, así que la columna existe igual y se marca. */
interface GridCol {
  id: number;
  nombre: string;
  color: string;
  activa: boolean;
}
interface GridData {
  open: boolean;
  rows: { label: string; min: number }[];
  cols: GridCol[];
  blocks: GridBlock[];
}

const COLOR_CANCHA_DEFAULT = '#0a8a99';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AdminNavComponent,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    WhatsappArPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class PanelComponent {
  private readonly turnos = inject(TurnosService);
  private readonly agendaApi = inject(AgendaConfigService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly primeng = inject(PrimeNG);

  readonly today = startOfDay(new Date());

  // ── Buscador por nombre (aplica a pendientes y a la agenda del día) ──
  readonly query = signal('');
  // ── Vista de la agenda: grilla (canchas × horas) por default; se recuerda en localStorage ──
  // v2: bump de la clave para resetear preferencias viejas ('lista') a la default (grilla) una vez.
  // De acá en más sigue recordando la elección del usuario bajo la clave nueva.
  private static readonly VISTA_KEY = 'padel_panel_vista_v2';
  private readonly platformId = inject(PLATFORM_ID);
  readonly vista = signal<'lista' | 'grilla'>('grilla');
  /** En mobile la grilla genera scroll horizontal feo → forzamos Lista (y ocultamos el toggle). */
  readonly isMobile = signal(false);
  readonly vistaEfectiva = computed<'lista' | 'grilla'>(() =>
    this.isMobile() ? 'lista' : this.vista()
  );
  /** Config de agenda (horario/paso/canchas) para armar la grilla. */
  private readonly agenda = signal<AgendaConfig | null>(null);

  readonly selectedDay = signal<Date>(this.today);
  readonly calValue = signal<Date>(this.today);
  readonly calOpen = signal(false);

  readonly list = signal<Turno[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  /** Estado del pago de seña por reserva (solo las que tienen pago registrado). */
  readonly pagoEstados = signal<Record<number, string>>({});
  /** reservaId con una devolución en vuelo (evita doble click → doble request). */
  readonly devolviendo = signal<number | null>(null);

  // ── Pendientes de seña (todas las fechas; se validan acá) ──
  readonly pendientes = signal<Pendiente[]>([]);
  readonly tienePendientes = computed(() => this.pendientes().length > 0);
  /** Pendientes que matchean el buscador (por nombre del cliente). */
  readonly pendientesFiltrados = computed(() => {
    const q = norm(this.query().trim());
    if (!q) return this.pendientes();
    return this.pendientes().filter((p) => norm(p.clienteNombre).includes(q));
  });

  // ── Arrepentimientos (Res. 424/2020) no gestionados ──
  readonly arrepentimientos = signal<Arrepentimiento[]>([]);
  readonly arrepentimientosPendientes = computed(() =>
    this.arrepentimientos().filter((a) => !a.gestionado)
  );
  readonly tieneArrepentimientos = computed(() => this.arrepentimientosPendientes().length > 0);

  readonly empty = computed(
    () => this.loaded() && !this.loading() && this.list().length === 0
  );

  readonly fechaLabel = computed(() => {
    const d = this.selectedDay();
    return `${DOWS[d.getDay()]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  });

  // Partes de la fecha para la tarjeta fija del sidebar.
  readonly diaNum = computed(() => this.selectedDay().getDate());
  readonly mesLabel = computed(() => MES_ABBR[this.selectedDay().getMonth()]);
  readonly dowLabel = computed(() => DOWS[this.selectedDay().getDay()]);

  /** Filtro por cancha, por id (null = todas). Por id y no por nombre: dos canchas pueden llamarse
   *  igual, y el nombre no alcanza para distinguirlas ni acá ni en la grilla. */
  readonly canchaFilter = signal<number | null>(null);

  /** Canchas presentes en los turnos del día (para armar el filtro), ordenadas naturalmente. */
  readonly canchas = computed(() => {
    const porId = new Map<number, string>();
    for (const t of this.list()) {
      if (t.canchaNombre) porId.set(t.canchaId, t.canchaNombre);
    }
    return [...porId]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  });

  /** Nombre de la cancha filtrada (para el cartel de "no hay turnos en …"). */
  readonly canchaFilterLabel = computed(() => {
    const f = this.canchaFilter();
    return this.canchas().find((c) => c.id === f)?.nombre ?? '';
  });

  /** Turnos visibles: filtrados por cancha + buscador, ordenados por hora y luego cancha. */
  readonly ordered = computed(() => {
    const f = this.canchaFilter();
    const q = norm(this.query().trim());
    return this.list()
      .filter((t) => f === null || t.canchaId === f)
      .filter((t) => !q || norm(t.clienteNombre).includes(q))
      .sort(
        (a, b) =>
          a.hora.localeCompare(b.hora) ||
          (a.canchaNombre ?? '').localeCompare(b.canchaNombre ?? '')
      );
  });

  /**
   * Grilla canchas × franjas horarias para el día elegido. Usa el horario/paso/canchas de la
   * config; cada turno se ubica en su columna (cancha) y ocupa tantas filas como su duración.
   * `null` si todavía no cargó la config; `open:false` si el club no abre ese día.
   *
   * Regla de oro acá: **todo turno del día tiene que dibujarse**. La grilla es la vista con la que
   * el dueño se para en el mostrador, así que un turno que existe y no aparece es peor que no tener
   * grilla. Por eso las columnas y las filas se estiran a lo que haya (canchas que ya no se ofrecen,
   * horarios fuera de la ventana del club) en vez de descartar lo que no encaja.
   */
  readonly grid = computed<GridData | null>(() => {
    const cfg = this.agenda();
    if (!cfg) return null;
    const dow = (this.selectedDay().getDay() + 6) % 7; // JS 0=Dom → 0=Lun..6=Dom
    const dia = cfg.week.find((d) => d.diaSemana === dow);
    if (!dia || !dia.open) return { open: false, rows: [], cols: [], blocks: [] };

    const paso = cfg.pasoMinutos > 0 ? cfg.pasoMinutos : 30;
    const q = norm(this.query().trim());
    const filtro = this.canchaFilter();
    const visibles = this.list().filter(
      (t) => (!q || norm(t.clienteNombre).includes(q)) && (filtro === null || t.canchaId === filtro)
    );

    // Columnas: las canchas que hoy se ofrecen, en su orden. Más las que ya no se ofrecen (inactivas
    // o dadas de baja) pero tienen turnos ese día: la baja conserva las reservas, así que el club
    // igual las tiene que jugar. Van al final y marcadas, no escondidas.
    const cols: GridCol[] = [...cfg.canchas]
      .filter((c) => c.estado === 'ACTIVO')
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ id: c.id, nombre: c.nombre, color: c.color || COLOR_CANCHA_DEFAULT, activa: true }));
    // Las extra salen de TODOS los turnos del día, no de los visibles: así el juego de columnas no
    // depende de lo que esté tipeado en el buscador, y filtrar por una cancha fuera de servicio
    // sigue encontrando su columna.
    for (const t of this.list()) {
      if (!cols.some((c) => c.id === t.canchaId)) {
        cols.push({
          id: t.canchaId,
          nombre: t.canchaNombre,
          color: cfg.canchas.find((c) => c.id === t.canchaId)?.color || COLOR_CANCHA_DEFAULT,
          activa: false,
        });
      }
    }
    const colsVisibles = filtro === null ? cols : cols.filter((c) => c.id === filtro);

    // Filas: la ventana del club, estirada para cubrir cualquier turno que haya quedado afuera (el
    // club recortó su horario después de tomada la reserva, por ejemplo). "00:00" como cierre es
    // medianoche = 24:00, igual que en la pantalla de configuración: leerlo como 0 dejaba la grilla
    // entera sin filas.
    const abre = hhmmToMin(dia.from);
    const cierra = dia.to === '00:00' ? 24 * 60 : hhmmToMin(dia.to);
    let desde = abre;
    let hasta = Math.max(cierra, abre + paso);
    for (const t of visibles) {
      const ini = hhmmToMin(t.hora);
      if (ini < desde) desde -= Math.ceil((desde - ini) / paso) * paso;
      hasta = Math.max(hasta, ini + Math.max(t.duracionMinutos, paso));
    }
    const rows: { label: string; min: number }[] = [];
    for (let m = desde; m < hasta; m += paso) rows.push({ label: minToHhmm(m), min: m });

    const blocks: GridBlock[] = [];
    for (const t of visibles) {
      const col = colsVisibles.findIndex((c) => c.id === t.canchaId);
      if (col < 0) continue;
      const rowStart = Math.round((hhmmToMin(t.hora) - desde) / paso);
      const span = Math.max(1, Math.round(t.duracionMinutos / paso));
      blocks.push({ col, rowStart, rowSpan: Math.min(span, rows.length - rowStart), turno: t });
    }
    return { open: true, rows, cols: colsVisibles, blocks };
  });

  /** Cantidad de turnos visibles (para el resumen del sidebar). */
  readonly count = computed(() => this.ordered().length);

  /** Hay turnos en el día pero el filtro de cancha no deja ninguno a la vista. */
  readonly noMatch = computed(
    () => this.loaded() && !this.loading() && this.list().length > 0
      && this.canchaFilter() !== null && this.ordered().length === 0
  );

  setCanchaFilter(c: number | null): void {
    this.canchaFilter.set(c);
  }

  setQuery(v: string): void { this.query.set(v); }
  setVista(v: 'lista' | 'grilla'): void {
    this.vista.set(v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(PanelComponent.VISTA_KEY, v);
    }
  }

  /** Mostramos siempre la cancha del turno. */
  readonly showCancha = computed(() => true);

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    this.load(this.today);
    this.loadPendientes();
    this.loadAgenda();
    this.loadArrepentimientos();
    // Preferencia de vista guardada + detección de mobile (solo browser; no rompe SSR/hidratación).
    afterNextRender(() => {
      const v = localStorage.getItem(PanelComponent.VISTA_KEY);
      if (v === 'lista' || v === 'grilla') this.vista.set(v);
      const mq = window.matchMedia('(max-width: 760px)');
      this.isMobile.set(mq.matches);
      mq.addEventListener('change', (e) => this.isMobile.set(e.matches));
    });
  }

  /** Config de agenda para la grilla. Si falla, la grilla queda deshabilitada (la lista sigue). */
  private loadAgenda(): void {
    this.agendaApi.getConfig().subscribe({
      next: (cfg) => this.agenda.set(cfg),
      error: () => this.agenda.set(null),
    });
  }

  // ── Pendientes de seña ──
  private loadPendientes(): void {
    this.turnos.pendientes().subscribe({
      next: (ps) => this.pendientes.set(ps),
      error: () => this.pendientes.set([]),
    });
  }

  /** Fecha "Día N mes" del pendiente (cruza días, por eso no alcanza con la hora). */
  pendFecha(p: Pendiente): string {
    const [y, m, d] = p.fecha.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DOWS[dt.getDay()]} ${dt.getDate()} ${MES_ABBR[dt.getMonth()]}`;
  }

  /** Hora a la que vence la ventana de pago (HH:mm), del ISO local `expiraEn`. */
  pendExpira(p: Pendiente): string {
    return p.expiraEn ? p.expiraEn.slice(11, 16) : '—';
  }

  confirmarSena(p: Pendiente): void {
    this.turnos.confirmarSena(p.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Seña confirmada', detail: p.clienteNombre });
        this.loadPendientes();
        this.load(this.selectedDay());
      },
      error: (err) => {
        // 409 = la seña venció mientras tanto; refrescamos para que salga de la lista.
        this.messages.add({
          severity: 'warn',
          summary: 'No se pudo confirmar',
          detail: err?.error?.error ?? 'La seña ya no es válida. Actualizamos la lista.',
        });
        this.loadPendientes();
      },
    });
  }

  askRechazarSena(p: Pendiente): void {
    this.confirm.confirm({
      header: 'Rechazar seña',
      message: `¿Rechazar la reserva de ${p.clienteNombre}? El turno se libera.`,
      acceptLabel: 'Rechazar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doRechazarSena(p),
    });
  }

  private doRechazarSena(p: Pendiente): void {
    this.turnos.rechazarSena(p.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Rechazada', detail: p.clienteNombre });
        this.loadPendientes();
        this.load(this.selectedDay());
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos rechazar la reserva. Probá de nuevo.',
        });
        this.loadPendientes();
      },
    });
  }

  // ── Arrepentimientos (Res. 424/2020) ──
  private loadArrepentimientos(): void {
    this.turnos.getArrepentimientos().subscribe({
      next: (as) => this.arrepentimientos.set(as),
      error: () => this.arrepentimientos.set([]),
    });
  }

  /** Marca gestionada una solicitud de arrepentimiento (reversible por DB, sin ConfirmDialog). */
  gestionarArrepentimiento(a: Arrepentimiento): void {
    this.turnos.gestionarArrepentimiento(a.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Gestionado', detail: a.nombre });
        this.loadArrepentimientos();
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos marcarlo como gestionado. Probá de nuevo.',
        });
      },
    });
  }

  isToday(): boolean {
    return !this.calOpen() && sameDay(this.selectedDay(), this.today);
  }
  isTomorrow(): boolean {
    return !this.calOpen() && sameDay(this.selectedDay(), addDays(this.today, 1));
  }

  selectToday(): void {
    this.calOpen.set(false);
    this.selectedDay.set(this.today);
    this.calValue.set(this.today);
    this.load(this.today);
  }
  selectTomorrow(): void {
    const t = addDays(this.today, 1);
    this.calOpen.set(false);
    this.selectedDay.set(t);
    this.calValue.set(t);
    this.load(t);
  }
  toggleCalendar(): void {
    this.calOpen.update((v) => !v);
  }
  onPickerSelect(value: Date): void {
    if (!value) return;
    const day = startOfDay(value);
    this.calValue.set(day);
    this.selectedDay.set(day);
    this.load(day);
  }

  private apiFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Reserva manual (el dueño carga un turno a mano; p. ej. una seña transferida tarde) ──
  readonly mOpen = signal(false);
  readonly mFecha = signal('');
  readonly mDuracion = signal<number | null>(null);
  readonly mSlots = signal<SlotLibre[]>([]);
  readonly mLoadingSlots = signal(false);
  readonly mHora = signal<string | null>(null);
  readonly mCanchaId = signal<number | null>(null);
  readonly mNombre = signal('');
  readonly mTel = signal('');
  readonly mSaving = signal(false);

  readonly mDuraciones = computed<number[]>(() => this.agenda()?.duraciones ?? [60, 90, 120]);
  readonly mSlotsLibres = computed(() => this.mSlots().filter((s) => s.disponible));
  readonly mCanchasDelSlot = computed(() => {
    const hora = this.mHora();
    return this.mSlotsLibres().find((s) => s.hora === hora)?.canchasLibres ?? [];
  });
  readonly mValid = computed(
    () => this.mFecha() !== '' && this.mHora() !== null && this.mNombre().trim().length >= 2,
  );

  openManual(): void {
    this.mFecha.set(this.apiFecha(this.selectedDay() < this.today ? this.today : this.selectedDay()));
    this.mDuracion.set(this.agenda()?.duracionDefault ?? this.mDuraciones()[0]);
    this.mHora.set(null);
    this.mCanchaId.set(null);
    this.mNombre.set('');
    this.mTel.set('');
    this.mOpen.set(true);
    this.mLoadSlots();
  }

  closeManual(): void {
    this.mOpen.set(false);
  }

  mSetFecha(fecha: string): void {
    this.mFecha.set(fecha);
    this.mLoadSlots();
  }

  mSetDuracion(d: number): void {
    this.mDuracion.set(d);
    this.mLoadSlots();
  }

  mSetHora(hora: string): void {
    this.mHora.set(hora);
    this.mCanchaId.set(null); // las canchas libres cambian con el slot
  }

  private mLoadSlots(): void {
    const fecha = this.mFecha();
    const dur = this.mDuracion();
    this.mHora.set(null);
    this.mCanchaId.set(null);
    if (!fecha || !dur) {
      this.mSlots.set([]);
      return;
    }
    this.mLoadingSlots.set(true);
    this.turnos.disponibilidad(fecha, dur).subscribe({
      next: (slots) => {
        this.mSlots.set(slots);
        this.mLoadingSlots.set(false);
      },
      error: () => {
        this.mSlots.set([]);
        this.mLoadingSlots.set(false);
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos cargar los horarios.' });
      },
    });
  }

  mGuardar(): void {
    if (!this.mValid() || this.mSaving()) return;
    this.mSaving.set(true);
    this.turnos
      .crearManual({
        canchaId: this.mCanchaId(),
        fecha: this.mFecha(),
        hora: this.mHora()!,
        duracion: this.mDuracion() ?? 90,
        clienteNombre: this.mNombre().trim(),
        clienteWhatsapp: this.mTel().trim() || null,
      })
      .subscribe({
        next: (r) => {
          this.mSaving.set(false);
          this.mOpen.set(false);
          this.messages.add({
            severity: 'success',
            summary: 'Reserva creada',
            detail: `${this.mNombre().trim()} · ${r.canchaNombre}`,
          });
          // Saltar al día de la reserva para que se vea recién creada.
          const [y, m, d] = this.mFecha().split('-').map(Number);
          const day = startOfDay(new Date(y, m - 1, d));
          this.calOpen.set(false);
          this.selectedDay.set(day);
          this.calValue.set(day);
          this.load(day);
          this.loadPendientes();
        },
        error: (err) => {
          this.mSaving.set(false);
          this.messages.add({
            severity: 'warn',
            summary: 'No se pudo crear',
            detail: err?.error?.error ?? 'Revisá el horario elegido: puede haberse ocupado.',
          });
          this.mLoadSlots(); // refresca por si el slot se ocupó mientras tanto
        },
      });
  }

  private load(day: Date): void {
    this.loading.set(true);
    this.loaded.set(false);
    this.list.set([]);
    this.canchaFilter.set(null); // el filtro por cancha se resetea al cambiar de día
    this.turnos.turnosDelDia(this.apiFecha(day)).subscribe({
      next: (turnos) => {
        this.list.set(turnos);
        this.loading.set(false);
        this.loaded.set(true);
        this.loadPagoEstados(turnos);
      },
      error: () => {
        this.list.set([]);
        this.loading.set(false);
        this.loaded.set(true);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar los turnos. Probá de nuevo.',
        });
      },
    });
  }

  /** Estado de pago de seña por reserva, para el panel (chip + botón Devolver). */
  private loadPagoEstados(turnos: Turno[]): void {
    const ids = turnos.map((t) => t.id);
    if (ids.length === 0) {
      this.pagoEstados.set({});
      return;
    }
    this.turnos.getSenaPagoEstados(ids).subscribe({
      next: (m) => this.pagoEstados.set(m),
      error: () => this.pagoEstados.set({}),
    });
  }

  senaPagoDe(id: number): string | null {
    return this.pagoEstados()[id] ?? null;
  }

  askDevolverSena(t: Turno): void {
    if (this.devolviendo() === t.id) return; // ya hay una devolución en vuelo para esta reserva
    this.confirm.confirm({
      header: 'Devolver seña',
      message: `¿Devolver la seña de ${t.clienteNombre}? Se reembolsa el pago a su Mercado Pago.`,
      acceptLabel: 'Devolver seña',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDevolverSena(t),
    });
  }

  private doDevolverSena(t: Turno): void {
    this.devolviendo.set(t.id);
    this.turnos.devolverSena(t.id).subscribe({
      next: () => {
        this.devolviendo.set(null);
        this.pagoEstados.update((m) => ({ ...m, [t.id]: 'DEVUELTO' }));
        this.messages.add({ severity: 'success', summary: 'Listo', detail: 'Seña devuelta' });
      },
      error: (err) => {
        this.devolviendo.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo devolver',
          detail: err?.error?.error ?? 'No pudimos devolver la seña. Probá de nuevo.',
        });
      },
    });
  }

  askCancel(t: Turno): void {
    this.confirm.confirm({
      header: 'Cancelar turno',
      message: `¿Cancelar el turno de ${t.clienteNombre} a las ${t.hora}?`,
      acceptLabel: 'Cancelar turno',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doCancel(t),
    });
  }

  private doCancel(t: Turno): void {
    this.turnos.cancelar(t.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Listo', detail: 'Turno cancelado' });
        this.load(this.selectedDay());
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cancelar el turno. Probá de nuevo.',
        });
      },
    });
  }
}
