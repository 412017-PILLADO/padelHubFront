import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { CanchaLibre, Slot } from '../../core/api/booking.service';
import { ArrepentimientoModal } from './arrepentimiento-modal/arrepentimiento-modal';
import { PoliticaModal } from './politica-modal/politica-modal';
import { ClubStore } from './club.store';
import { BookingStore } from './booking/booking.store';

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
  providers: [MessageService, ClubStore, BookingStore],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { '[attr.data-tpl]': 'plantilla()' },
})
export class Landing {
  private readonly primeng = inject(PrimeNG);
  private readonly club = inject(ClubStore);
  private readonly booking = inject(BookingStore);

  // ── Identidad del club (config, branding, SEO, horarios, contacto, seña) ──────────
  // Alias hacia ClubStore: andamio a propósito para no tocar landing.html en este refactor.
  readonly config = this.club.config;
  readonly tenantNombre = this.club.tenantNombre;
  readonly tenantPrimerNombre = this.club.tenantPrimerNombre;
  readonly plantilla = this.club.plantilla;
  readonly previewPlantilla = this.club.previewPlantilla;
  readonly logoSrc = this.club.logoSrc;
  readonly horarios = this.club.horarios;
  readonly direccion = this.club.direccion;
  readonly mapaUrl = this.club.mapaUrl;
  readonly whatsappUrl = this.club.whatsappUrl;
  readonly instagramHandle = this.club.instagramHandle;
  readonly instagramUrl = this.club.instagramUrl;
  readonly mostrarPrecios = this.club.mostrarPrecios;
  readonly requiereTelefono = this.club.requiereTelefono;
  readonly requiereSena = this.club.requiereSena;
  readonly senaMonto = this.club.senaMonto;
  readonly senaMontoFmt = this.club.senaMontoFmt;
  readonly senaAlias = this.club.senaAlias;

  /** Click en el selector flotante A/B/C: delega en ClubStore (ver ahí el detalle). */
  setPreviewPlantilla(tpl: string): void {
    this.club.setPreviewPlantilla(tpl);
  }

  // ── Flujo de reserva (duración, día, hora, cancha, datos, confirmación, éxito) ────
  // Mismo andamio que arriba, ahora hacia BookingStore: los nombres son los que ya usa landing.html.
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

  // ── Botón de arrepentimiento (Res. 424/2020) ───────────────────────
  readonly showArrep = signal(false);

  // ── Política de cancelación (texto libre del club) ─────────────────
  readonly showPolitica = signal(false);

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    // El fetch es async y el flujo de reserva depende de él: BookingStore lo espera con un effect
    // sobre estadoCarga() (duración default + día inicial, o defaults + toast si falla).
    this.club.cargar();
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
}
