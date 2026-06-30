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

import { Turno, TurnosService } from '../../../core/api/turnos.service';
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
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly primeng = inject(PrimeNG);

  readonly today = startOfDay(new Date());

  readonly selectedDay = signal<Date>(this.today);
  readonly calValue = signal<Date>(this.today);
  readonly calOpen = signal(false);

  readonly list = signal<Turno[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  readonly empty = computed(
    () => this.loaded() && !this.loading() && this.list().length === 0
  );

  readonly fechaLabel = computed(() => {
    const d = this.selectedDay();
    return `${DOWS[d.getDay()]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  });

  /** Mostramos siempre la cancha del turno. */
  readonly showCancha = computed(() => true);

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    this.load(this.today);
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
