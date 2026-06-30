import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

const MES_ABBR = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const DOWS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];
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
  imports: [FormsModule, RouterLink, DatePickerModule, InputTextModule, ToastModule],
  providers: [MessageService],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private readonly booking = inject(BookingService);
  private readonly messages = inject(MessageService);
  private readonly primeng = inject(PrimeNG);

  // ── Config pública del tenant (GET /public/config) ────────────────
  readonly config = signal<PublicConfig | null>(null);

  readonly tenantNombre = computed(() => this.config()?.complejo.nombre ?? 'Tu club');
  readonly tenantPrimerNombre = computed(() => this.tenantNombre().split(/\s+/)[0]);

  readonly mostrarPrecios = computed(() => this.config()?.tenant.mostrarPrecios ?? false);
  readonly requiereTelefono = computed(() => this.config()?.tenant.requiereTelefono ?? true);

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
    groupHorarios(this.config()?.horarios ?? [])
  );

  readonly today = startOfDay(new Date());
  readonly minDate = this.today;

  // ── Paso 1 · Duración ─────────────────────────────────────────────
  readonly duraciones = computed(() => this.config()?.duracionesPermitidas ?? [60, 90, 120]);
  readonly duracion = signal<number>(90);

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

  readonly success = signal(false);
  readonly successData = signal<{
    cancha: string;
    dia: string;
    hora: string;
    duracion: number;
    primerNombre: string;
  } | null>(null);

  // ── Day chips ─────────────────────────────────────────────────────
  readonly chips = computed(() => [
    { label: 'Hoy', date: this.today },
    { label: 'Mañana', date: addDays(this.today, 1) },
    { label: 'Pasado', date: addDays(this.today, 2) },
  ]);

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

  readonly formValid = computed(() => {
    const nombreOk = this.nombre().trim().length >= 2;
    if (!this.requiereTelefono()) return nombreOk;
    const phoneDigits = this.whatsapp().replace(/\D/g, '');
    return nombreOk && phoneDigits.length >= 6;
  });
  readonly canConfirm = computed(() => this.canchaDone() && this.formValid());
  readonly formOpen = computed(() => this.canchaDone());

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
    this.loadConfig();
  }

  private loadConfig(): void {
    this.booking.config().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
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
    const day = startOfDay(value);
    this.pickerValue.set(day);
    this.selectedDay.set(day);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.loadAvailability(day);
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
    this.selectedCancha.set(null);
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
          });
          this.success.set(true);
          window.scrollTo(0, 0);
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

  backHome(): void {
    this.success.set(false);
    this.successData.set(null);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.nombre.set('');
    this.whatsapp.set('');
    this.calOpen.set(false);
    this.selectDay(this.today);
    window.scrollTo(0, 0);
  }

  openMaps(): void {
    const url = this.mapaUrl();
    if (url) window.open(url, '_blank');
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
