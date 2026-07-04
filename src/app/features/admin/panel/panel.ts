import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { Pendiente, Turno, TurnosService } from '../../../core/api/turnos.service';
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
interface GridData {
  open: boolean;
  rows: { label: string; min: number }[];
  cols: { id: number; nombre: string; color: string }[];
  blocks: GridBlock[];
}

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
  // ── Vista de la agenda: lista o grilla (canchas × horas) ──
  readonly vista = signal<'lista' | 'grilla'>('lista');
  /** Config de agenda (horario/paso/canchas) para armar la grilla. */
  private readonly agenda = signal<AgendaConfig | null>(null);

  readonly selectedDay = signal<Date>(this.today);
  readonly calValue = signal<Date>(this.today);
  readonly calOpen = signal(false);

  readonly list = signal<Turno[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  // ── Pendientes de seña (todas las fechas; se validan acá) ──
  readonly pendientes = signal<Pendiente[]>([]);
  readonly tienePendientes = computed(() => this.pendientes().length > 0);
  /** Pendientes que matchean el buscador (por nombre del cliente). */
  readonly pendientesFiltrados = computed(() => {
    const q = norm(this.query().trim());
    if (!q) return this.pendientes();
    return this.pendientes().filter((p) => norm(p.clienteNombre).includes(q));
  });

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

  /** Filtro por cancha (null = todas). */
  readonly canchaFilter = signal<string | null>(null);

  /** Canchas presentes en los turnos del día (para armar el filtro), ordenadas naturalmente. */
  readonly canchas = computed(() => {
    const set = new Set<string>();
    for (const t of this.list()) {
      if (t.canchaNombre) set.add(t.canchaNombre);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  });

  /** Turnos visibles: filtrados por cancha + buscador, ordenados por hora y luego cancha. */
  readonly ordered = computed(() => {
    const f = this.canchaFilter();
    const q = norm(this.query().trim());
    return this.list()
      .filter((t) => !f || t.canchaNombre === f)
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
   */
  readonly grid = computed<GridData | null>(() => {
    const cfg = this.agenda();
    if (!cfg) return null;
    const dow = (this.selectedDay().getDay() + 6) % 7; // JS 0=Dom → 0=Lun..6=Dom
    const dia = cfg.week.find((d) => d.diaSemana === dow);
    if (!dia || !dia.open) return { open: false, rows: [], cols: [], blocks: [] };

    const paso = cfg.pasoMinutos > 0 ? cfg.pasoMinutos : 30;
    const fromMin = hhmmToMin(dia.from);
    const toMin = hhmmToMin(dia.to);
    const rows: { label: string; min: number }[] = [];
    for (let m = fromMin; m < toMin; m += paso) rows.push({ label: minToHhmm(m), min: m });

    const cols = [...cfg.canchas]
      .filter((c) => c.estado === 'ACTIVO')
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ id: c.id, nombre: c.nombre, color: c.color || '#2747ff' }));

    const q = norm(this.query().trim());
    const blocks: GridBlock[] = [];
    for (const t of this.list()) {
      if (q && !norm(t.clienteNombre).includes(q)) continue;
      const col = cols.findIndex((c) => c.nombre === t.canchaNombre);
      if (col < 0) continue;
      const rowStart = Math.round((hhmmToMin(t.hora) - fromMin) / paso);
      if (rowStart < 0 || rowStart >= rows.length) continue;
      const span = Math.max(1, Math.round(t.duracionMinutos / paso));
      blocks.push({ col, rowStart, rowSpan: Math.min(span, rows.length - rowStart), turno: t });
    }
    return { open: true, rows, cols, blocks };
  });

  /** Cantidad de turnos visibles (para el resumen del sidebar). */
  readonly count = computed(() => this.ordered().length);

  /** Hay turnos en el día pero el filtro de cancha no deja ninguno a la vista. */
  readonly noMatch = computed(
    () => this.loaded() && !this.loading() && this.list().length > 0
      && this.canchaFilter() !== null && this.ordered().length === 0
  );

  setCanchaFilter(c: string | null): void {
    this.canchaFilter.set(c);
  }

  setQuery(v: string): void { this.query.set(v); }
  setVista(v: 'lista' | 'grilla'): void { this.vista.set(v); }

  /** Mostramos siempre la cancha del turno. */
  readonly showCancha = computed(() => true);

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    this.load(this.today);
    this.loadPendientes();
    this.loadAgenda();
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
