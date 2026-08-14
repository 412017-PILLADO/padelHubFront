import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';

import { CanchaLibre, Slot } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { BookingStore } from './booking.store';

/**
 * Los pasos de la reserva: duración, día, horario, cancha y datos. Es el corazón funcional de la
 * landing y NO tiene identidad visual propia — se pinta con los tokens `--flow-*` que declara el
 * shell de cada plantilla (ver la spec de plantillas, §4). No agregar acá reglas que dependan de
 * una plantilla en particular.
 *
 * La encapsulación es la default (Emulated): la hoja no se filtra al resto de la app. Hasta el
 * Task 10 tenía `ViewEncapsulation.None`, porque las plantillas pintaban el interior del flujo
 * desde afuera (`.tpl-b .booking-flow`, `.tpl-c .flow-head .mono`) y esas reglas necesitaban una
 * hoja global para casar. Ya no existen: todo eso viaja por los tokens `--flow-*`. Si alguna vez
 * hace falta volver a `None`, es la señal de que algo se está pintando desde afuera y de que
 * falta un token.
 *
 * No provee los stores: los toma del injector de `Landing`, que es quien los declara. Así los dos
 * comparten la misma instancia (el flujo y la cáscara hablan del mismo club y de la misma reserva).
 */
@Component({
  selector: 'app-booking-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePickerModule, InputTextModule],
  templateUrl: './booking-flow.html',
  styleUrl: './booking-flow.scss',
})
export class BookingFlowComponent {
  private readonly club = inject(ClubStore);
  private readonly booking = inject(BookingStore);

  /**
   * El modal de la política de cancelación es transversal a las 3 plantillas y vive en `Landing`
   * (junto al de arrepentimiento): el bloque de seña de la pantalla de éxito solo avisa que hay que
   * abrirlo. Mismo contrato que usará el pie en el Task 4.
   */
  readonly abrirPolitica = output<void>();

  // ── Identidad del club (lo que el flujo necesita de ClubStore) ─────
  // Alias con los nombres que ya usaba landing.html: el template se movió verbatim.
  readonly config = this.club.config;
  readonly tenantNombre = this.club.tenantNombre;
  readonly mostrarPrecios = this.club.mostrarPrecios;
  readonly requiereTelefono = this.club.requiereTelefono;

  // ── Estado de la reserva (BookingStore) ────────────────────────────
  readonly minDate = this.booking.minDate;
  readonly duraciones = this.booking.duraciones;
  readonly duracion = this.booking.duracion;
  readonly showDuracion = this.booking.showDuracion;
  readonly showCancha = this.booking.showCancha;
  readonly stepNums = this.booking.stepNums;
  readonly chips = this.booking.chips;
  readonly customDay = this.booking.customDay;
  readonly calOpen = this.booking.calOpen;
  readonly pickerValue = this.booking.pickerValue;
  readonly slots = this.booking.slots;
  readonly loadingSlots = this.booking.loadingSlots;
  readonly selectedTime = this.booking.selectedTime;
  readonly canchasDelSlot = this.booking.canchasDelSlot;
  readonly ANY = this.booking.ANY;
  readonly dayDone = this.booking.dayDone;
  readonly timeDone = this.booking.timeDone;
  readonly canchaDone = this.booking.canchaDone;
  readonly timeHint = this.booking.timeHint;
  readonly showTimes = this.booking.showTimes;
  readonly nombre = this.booking.nombre;
  readonly whatsapp = this.booking.whatsapp;
  readonly empresa = this.booking.empresa;
  readonly nombreTouched = this.booking.nombreTouched;
  readonly whatsappTouched = this.booking.whatsappTouched;
  readonly nombreValid = this.booking.nombreValid;
  readonly whatsappValid = this.booking.whatsappValid;
  readonly formValid = this.booking.formValid;
  readonly formOpen = this.booking.formOpen;
  readonly canConfirm = this.booking.canConfirm;
  readonly confirmBlockedReason = this.booking.confirmBlockedReason;
  readonly precioResumen = this.booking.precioResumen;
  readonly recap = this.booking.recap;
  readonly enviando = this.booking.enviando;
  readonly success = this.booking.success;
  readonly successData = this.booking.successData;
  readonly senaInitPoint = this.booking.senaInitPoint;
  readonly aliasCopiado = this.booking.aliasCopiado;
  readonly whatsappSenaUrl = this.booking.whatsappSenaUrl;

  pickDuracion(d: number): void {
    this.booking.pickDuracion(d);
  }
  chipDate(d: Date): string {
    return this.booking.chipDate(d);
  }
  isChipSelected(d: Date): boolean {
    return this.booking.isChipSelected(d);
  }
  selectDay(date: Date): void {
    this.booking.selectDay(date);
  }
  toggleCalendar(): void {
    this.booking.toggleCalendar();
  }
  onPickerSelect(value: Date): void {
    this.booking.onPickerSelect(value);
  }
  selectTime(slot: Slot): void {
    this.booking.selectTime(slot);
  }
  selectCancha(id: number): void {
    this.booking.selectCancha(id);
  }
  isCanchaSelected(id: number): boolean {
    return this.booking.isCanchaSelected(id);
  }
  materialLabel(c: CanchaLibre): string {
    return this.booking.materialLabel(c);
  }
  precioEsEspecial(c: CanchaLibre): boolean {
    return this.booking.precioEsEspecial(c);
  }
  precioTurno(c: CanchaLibre): string | null {
    return this.booking.precioTurno(c);
  }
  confirm(): void {
    this.booking.confirm();
  }
  backHome(): void {
    this.booking.backHome();
  }
  copyAlias(): void {
    this.booking.copyAlias();
  }
}
