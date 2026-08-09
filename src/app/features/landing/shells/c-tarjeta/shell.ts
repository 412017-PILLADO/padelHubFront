import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { cargarFuentes } from '../../../../core/landing/fuentes';
import { PLANTILLAS, urlFuentes } from '../../../../core/landing/plantillas';
import { ClubStore } from '../../club.store';
import { BookingFlowComponent } from '../../booking/booking-flow';
import { BrandMarkComponent } from '../../club/brand-mark';
import { ClubInfoComponent } from '../../club/club-info';
import { LandingFooterComponent } from '../../club/landing-footer';

/**
 * Cáscara de la plantilla C (compacta tipo app): rail claro con la marca y la info del club a la
 * izquierda, la reserva ocupando la columna principal.
 *
 * El `<div class="tpl-c">` que envolvía todo en `landing.html` es ahora el host (`host: { class }`):
 * los e2e siguen viendo `.tpl-c`, y `club-info.scss` / `booking-flow.scss` la siguen usando como
 * ancestro (`:host-context(.tpl-c)`, `.tpl-c .booking-flow`).
 *
 * Los dos modales son transversales a las 3 plantillas y viven en `Landing`: la cáscara solo avisa
 * que hay que abrirlos — mismo contrato que ya usan `<app-booking-flow>` y `<app-landing-footer>`.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-shell-c',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingFlowComponent, BrandMarkComponent, ClubInfoComponent, LandingFooterComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { class: 'tpl-c' },
})
export class ShellCComponent {
  private readonly club = inject(ClubStore);
  /** Inyectado (no el global): en SSR es el documento que se serializa — ver constructor. */
  private readonly doc = inject(DOCUMENT);

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  readonly tenantNombre = this.club.tenantNombre;

  constructor() {
    // Cada cáscara pide SU tipografía y ninguna más. Como esto corre también en el server, el
    // <link> viaja en el HTML servido y no hay parpadeo con la fuente del sistema hasta hidratar.
    cargarFuentes(this.doc, urlFuentes(PLANTILLAS.C.fuentes));
  }
}
