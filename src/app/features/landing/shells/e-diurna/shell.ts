import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { cargarFuentes } from '../../../../core/landing/fuentes';
import { PLANTILLAS, urlFuentes } from '../../../../core/landing/plantillas';
import { ClubStore } from '../../club.store';
import { BookingFlowComponent } from '../../booking/booking-flow';
import { BrandMarkComponent } from '../../club/brand-mark';
import { ClubInfoComponent } from '../../club/club-info';
import { LandingFooterComponent } from '../../club/landing-footer';

/**
 * Cáscara de la plantilla E (diurna): la hermana clara de B (spec §6). Campo de color arriba con la
 * marca y el título, y UN solo panel debajo con el flujo de reserva — un panel y no varias cards es
 * la primera línea del contrato §6.1, que la separa de C.
 *
 * El campo de arriba lleva el primario del club CRUDO con el secundario como luz radial, y el panel
 * se le monta a caballo del borde de abajo (`--e-solape` en shell.scss): esa franja de vidrio sobre
 * color es la firma de la plantilla. El vidrio no lo pinta la cáscara — lo declara `_tokens.scss`
 * como tokens `--flow-*` que el `<app-booking-flow>` consume.
 *
 * Los dos modales son transversales a las plantillas y viven en `Landing`: la cáscara solo avisa
 * que hay que abrirlos — mismo contrato que ya usan `<app-booking-flow>` y `<app-landing-footer>`.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-shell-e',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingFlowComponent, BrandMarkComponent, ClubInfoComponent, LandingFooterComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { class: 'tpl-e' },
})
export class ShellEComponent {
  private readonly club = inject(ClubStore);
  private readonly doc = inject(DOCUMENT);

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  readonly tenantNombre = this.club.tenantNombre;

  constructor() {
    // E reusa el trío de B (spec §6, pineado en plantillas.spec.ts), así que esto no agrega fuentes
    // al producto: `cargarFuentes` es idempotente por URL y las dos cáscaras comparten un solo
    // <link> sin coordinarse. Corre también en SSR (el DOCUMENT inyectado se serializa), así que el
    // HTML del server ya pide la tipografía de E y no parpadea con la de plataforma al hidratar.
    cargarFuentes(this.doc, urlFuentes(PLANTILLAS.E.fuentes));
  }
}
