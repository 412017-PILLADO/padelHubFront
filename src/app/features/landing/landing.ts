import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { ArrepentimientoModal } from './arrepentimiento-modal/arrepentimiento-modal';
import { PoliticaModal } from './politica-modal/politica-modal';
import { ClubStore } from './club.store';
import { BookingStore } from './booking/booking.store';
import { ShellAComponent } from './shells/a-afiche/shell';
import { ShellBComponent } from './shells/b-nocturna/shell';
import { ShellCComponent } from './shells/c-tarjeta/shell';

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

/**
 * Dispatcher de la landing: elige la cáscara de la plantilla del club (ver shells/) y se queda con
 * lo que es transversal a las tres — el toast, los defs SVG compartidos, los dos modales
 * (arrepentimiento y política) y el selector flotante del preview de venta.
 *
 * Es el dueño de los tres providers del árbol: `ClubStore` (quién es el club), `BookingStore` (qué
 * está reservando este visitante) y el `MessageService` de PrimeNG que alimenta al `<p-toast>`.
 * Las cáscaras y sus hijos los inyectan desde acá.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToastModule,
    ArrepentimientoModal,
    PoliticaModal,
    ShellAComponent,
    ShellBComponent,
    ShellCComponent,
  ],
  providers: [MessageService, ClubStore, BookingStore],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { '[attr.data-tpl]': 'plantilla()' },
})
export class Landing {
  private readonly primeng = inject(PrimeNG);
  private readonly club = inject(ClubStore);
  /**
   * Se inyecta acá y no recién cuando `<app-booking-flow>` lo pide (allá adentro de la cáscara):
   * `BookingStore` registra en su constructor el effect sobre `club.estadoCarga()`, y tiene que
   * estar registrado ANTES del `cargar()` de abajo. Con el transfer state del SSR la config puede
   * resolver sincrónicamente, antes del primer render — o sea, antes de que exista la cáscara.
   */
  private readonly booking = inject(BookingStore);

  /** La plantilla elegida: manda el `@switch` del template y el `data-tpl` del host. */
  readonly plantilla = this.club.plantilla;
  /** El texto de la política de cancelación sale de acá (`config()?.politicaCancelacion`). */
  readonly config = this.club.config;
  readonly previewPlantilla = this.club.previewPlantilla;

  /** Click en el selector flotante A/B/C: delega en ClubStore (ver ahí el detalle). */
  setPreviewPlantilla(tpl: string): void {
    this.club.setPreviewPlantilla(tpl);
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
}
