import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import {
  CODIGOS_CON_SHELL,
  CodigoPlantilla,
  PLANTILLAS,
  shellDePlantilla,
} from '../../core/landing/plantillas';
import { ArrepentimientoModal } from './arrepentimiento-modal/arrepentimiento-modal';
import { PoliticaModal } from './politica-modal/politica-modal';
import { ClubStore } from './club.store';
import { BookingStore } from './booking/booking.store';
import { ShellAComponent } from './shells/a-afiche/shell';
import { ShellBComponent } from './shells/b-nocturna/shell';
import { ShellCComponent } from './shells/c-tarjeta/shell';
import { ShellEComponent } from './shells/e-diurna/shell';

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
 * lo que es transversal a todas — el toast, los defs SVG compartidos, los dos modales
 * (arrepentimiento y política) y el selector flotante del preview de venta.
 *
 * Qué plantillas existen, cuál es la default y cuáles tienen cáscara lo decide el registry
 * (`core/landing/plantillas.ts`), no este archivo: `ClubStore.plantilla` ya viene normalizada contra
 * él y tanto el `data-tpl` del host como el selector de preview salen de ahí. Lo único que queda
 * acá es el mapeo código → componente, que el `@switch` del template tiene que escribir con
 * referencias estáticas para que el compilador de Angular las vea (`NgComponentOutlet` sabría
 * tomarlas de un mapa, pero no puede bindear los `output()` de las cáscaras).
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
    ShellEComponent,
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
   * La cáscara que se dibuja: manda el `@switch` del template Y el `data-tpl` del host, que tienen
   * que coincidir sí o sí. Un tenant en una plantilla que todavía no tiene cáscara (D, que el
   * back ya acepta) se dibuja con la A **y publica `data-tpl="A"`**: si publicara su propio código,
   * el `:host([data-tpl='A'])` de `landing.scss` no engancharía y el afiche quedaría sin su clamp
   * de viewport, con doble scroll. Ver `shellDePlantilla()`.
   */
  readonly plantilla = computed<CodigoPlantilla>(() => shellDePlantilla(this.club.plantilla()));
  /** El texto de la política de cancelación sale de acá (`config()?.politicaCancelacion`). */
  readonly config = this.club.config;
  readonly previewPlantilla = this.club.previewPlantilla;

  /** Botones del selector flotante: la ficha completa del registry de cada plantilla previsualizable
   *  (el código pinta el botón, el nombre va de tooltip para quien está mostrando los diseños). */
  readonly opcionesPreview = CODIGOS_CON_SHELL.map((codigo) => PLANTILLAS[codigo]);

  /** Click en el selector flotante: delega en ClubStore (ver ahí el detalle). */
  setPreviewPlantilla(tpl: CodigoPlantilla): void {
    this.club.setPreviewPlantilla(tpl);
  }

  // ── Botón de arrepentimiento (Res. 424/2020) ───────────────────────
  readonly showArrep = signal(false);

  // ── Política de cancelación (texto libre del club) ─────────────────
  readonly showPolitica = signal(false);

  constructor() {
    // Se inyecta por su EFECTO, no por su valor (por eso no queda guardado en ningún campo): fuerza
    // a que `BookingStore` se construya acá y no recién cuando `<app-booking-flow>` lo pida, ya
    // adentro de la cáscara y durante el primer render. Es el orden que tenía antes de que las
    // plantillas fueran componentes: el effect sobre `club.estadoCarga()` que registra su
    // constructor queda armado ANTES del `cargar()` de abajo (que con el transfer state del SSR
    // puede resolver sincrónicamente). No borrar ni reordenar: `landing.spec.ts` cubre esa carrera.
    inject(BookingStore);

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
