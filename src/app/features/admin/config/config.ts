import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
} from '../../../core/api/agenda-config.service';
import { CanchaConfig } from '../../../core/api/booking.service';
import { AdminNavComponent } from '../admin-nav/admin-nav';

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
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly primeng = inject(PrimeNG);

  readonly times = timeOptions();
  readonly dowLabels = DOW;
  readonly dowFull = DOW_FULL;
  readonly durOpciones = DURACION_OPCIONES;
  readonly tipoParedOpciones = TIPO_PARED_OPCIONES;
  readonly today = startOfDay(new Date());

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
  readonly cColor = signal('#2747ff');
  readonly canchaSaving = signal(false);

  readonly canchasOrdenadas = computed(() =>
    [...this.canchas()].sort((a, b) => a.orden - b.orden)
  );
  readonly canCanchaSave = computed(
    () => this.cNombre().trim().length > 0 && !this.canchaSaving()
  );

  // ── Bloqueos ──
  readonly bloqueos = signal<BloqueoItem[]>([]);
  readonly calValue = signal<Date | null>(null);
  /** null = todo el complejo. */
  readonly bloqueoCanchaId = signal<number | null>(null);
  readonly bloqueoMotivo = signal('');

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
  readonly canSave = computed(
    () => this.dirty() && !this.invalidPaso() && !this.invalidDuraciones()
      && !this.invalidPrecio() && !this.saving()
  );
  readonly saveState = computed(() => {
    if (this.invalidPaso()) return 'Revisá el paso (5–180 min)';
    if (this.invalidDuraciones()) return 'Elegí el turno principal';
    if (this.invalidPrecio()) return 'Cargá el precio general por hora';
    return this.dirty() ? 'Cambios sin guardar' : 'Todo guardado';
  });
  readonly breakStateLabel = computed(() =>
    this.breakOn() ? `${this.breakFrom()} — ${this.breakTo()}` : 'Sin pausa'
  );
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
    this.loaded.set(true);
  }

  // ── Horario ──
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
  onPrecioGeneralInput(value: string): void {
    const n = Number(value);
    this.precioHoraGeneral.set(value.trim() === '' || !Number.isFinite(n) ? null : Math.round(n));
    this.markDirty();
  }

  // ── Canchas ──
  startNewCancha(): void {
    this.editingCanchaId.set(null);
    this.cNombre.set('');
    this.cOrden.set(null);
    this.cTechada.set(false);
    this.cTipoPared.set('CRISTAL');
    this.cPrecio.set(null);
    this.cColor.set('#2747ff');
    this.canchaFormOpen.set(true);
  }

  editCancha(c: CanchaConfig): void {
    this.editingCanchaId.set(c.id);
    this.cNombre.set(c.nombre);
    this.cOrden.set(c.orden);
    this.cTechada.set(c.techada);
    this.cTipoPared.set(c.tipoPared ?? 'CRISTAL');
    this.cPrecio.set(c.precioHora);
    this.cColor.set(c.color ?? '#2747ff');
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
      this.api
        .putCancha(editingId, { nombre, orden, techada, tipoPared, precioHora, color, estado: 'ACTIVO' })
        .subscribe({ next: (saved) => done(saved, 'Cancha actualizada'), error: fail });
    }
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
    const motivo = this.bloqueoMotivo().trim() || null;
    this.api.postBloqueo({ fecha, canchaId, motivo }).subscribe({
      next: (created) => {
        this.bloqueos.update((list) => [...list, created]);
        this.bloqueoMotivo.set('');
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
  private markDirty(): void { this.dirty.set(true); }

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

    this.api
      .putHorarios({
        breakOn: this.breakOn(),
        breakFrom: this.breakFrom(),
        breakTo: this.breakTo(),
        week: this.week(),
      })
      .pipe(
        concatMap(() =>
          this.api.putDuraciones({
            pasoMinutos: this.pasoMinutos(),
            duraciones: this.duraciones(),
            duracionDefault: this.duracionDefault(),
            permitirOtrasDuraciones: this.permitirOtras(),
          })
        ),
        concatMap(() =>
          this.api.putPrecios({
            precioModo: this.precioModo(),
            precioHoraGeneral: this.precioModo() === 'GENERAL' ? this.precioHoraGeneral() : null,
          })
        ),
        concatMap(() => this.api.putContacto(contacto))
      )
      .subscribe({
        next: (cfg) => {
          this.applyConfig(cfg);
          this.saving.set(false);
          this.messages.add({ severity: 'success', summary: 'Guardado', detail: 'Cambios guardados' });
        },
        error: () => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No pudimos guardar. Probá de nuevo.',
          });
        },
      });
  }
}
