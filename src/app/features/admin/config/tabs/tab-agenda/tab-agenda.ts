import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

import { BloqueoItem } from '../../../../../core/api/agenda-config.service';
import { ConfigStateService, DOW_FULL } from '../../config-state.service';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
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

/** Pestaña "Agenda": horario semanal, descanso, turno/duraciones y bloqueo de días. Sin inputs/outputs:
 *  el estado se comparte con el resto de la pantalla vía `ConfigStateService` (heredado por DI del
 *  provider del padre `ConfigComponent`). */
@Component({
  selector: 'app-tab-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePickerModule, SelectModule],
  templateUrl: './tab-agenda.html',
  styleUrl: './tab-agenda.scss',
})
export class TabAgendaComponent {
  private readonly st = inject(ConfigStateService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly times = timeOptions();
  readonly dowLabels = DOW;
  readonly dowFull = DOW_FULL;
  readonly durOpciones = DURACION_OPCIONES;
  readonly today = startOfDay(new Date());

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly week = this.st.week;
  readonly breakOn = this.st.breakOn;
  readonly breakFrom = this.st.breakFrom;
  readonly breakTo = this.st.breakTo;
  readonly duracionDefault = this.st.duracionDefault;
  readonly permitirOtras = this.st.permitirOtras;
  readonly invalidBreak = this.st.invalidBreak;
  readonly breakStateLabel = this.st.breakStateLabel;
  readonly horarioAvisos = this.st.horarioAvisos;
  readonly bloqueosOrdenados = this.st.bloqueosOrdenados;
  readonly disabledDays = this.st.disabledDays;
  readonly canchaOpciones = this.st.canchaOpciones;
  readonly bloqueoCanchaId = this.st.bloqueoCanchaId;
  readonly bloqueoMotivo = this.st.bloqueoMotivo;
  readonly calValue = this.st.calValue;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual ──
  readonly toggleDay = this.st.toggleDay.bind(this.st);
  readonly setFrom = this.st.setFrom.bind(this.st);
  readonly setTo = this.st.setTo.bind(this.st);
  readonly toggleBreak = this.st.toggleBreak.bind(this.st);
  readonly setBreakFrom = this.st.setBreakFrom.bind(this.st);
  readonly setBreakTo = this.st.setBreakTo.bind(this.st);
  readonly isDurActive = this.st.isDurActive.bind(this.st);
  readonly toggleDur = this.st.toggleDur.bind(this.st);
  readonly setDefault = this.st.setDefault.bind(this.st);
  readonly togglePermitirOtras = this.st.togglePermitirOtras.bind(this.st);
  readonly setBloqueoCancha = this.st.setBloqueoCancha.bind(this.st);
  readonly setBloqueoMotivo = this.st.setBloqueoMotivo.bind(this.st);

  /** Etiqueta de una hora en el select de cierre: aclara que "00:00" es medianoche (24:00). */
  timeLabel(t: string): string {
    return t === '00:00' ? '00:00 (medianoche)' : t;
  }

  // ── Bloqueos ──
  onPickerSelect(value: Date): void {
    if (!value) return;
    const fecha = ymd(startOfDay(value));
    this.st.calValue.set(null);
    const canchaId = this.st.bloqueoCanchaId();
    const canchaLabel = this.st.canchaOpciones().find((o) => o.value === canchaId)?.label ?? 'todo el complejo';
    this.confirm.confirm({
      header: 'Bloquear día',
      message: `¿Bloquear el ${this.fechaLarga(fecha)} para ${canchaLabel}?`,
      acceptLabel: 'Bloquear',
      rejectLabel: 'Volver',
      accept: () => this.doCrearBloqueo(fecha, canchaId),
    });
  }

  private doCrearBloqueo(fecha: string, canchaId: number | null): void {
    this.st.crearBloqueo(fecha, canchaId).subscribe({
      next: () => {
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
    this.st.removeBloqueo(b).subscribe({
      next: () => {
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
}
