import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { ClubStore } from '../../club.store';
import { BookingFlowComponent } from '../../booking/booking-flow';
import { BrandMarkComponent } from '../../club/brand-mark';
import { ClubInfoComponent } from '../../club/club-info';
import { LandingFooterComponent } from '../../club/landing-footer';

/**
 * Cáscara de la plantilla C (básica): una sola columna centrada — marca, reserva, info del club y
 * pie, en ese orden y sin rail lateral (Task 4: el rail se sentía panel de admin).
 *
 * El `<div class="tpl-c">` que envolvía todo en `landing.html` es ahora el host (`host: { class }`):
 * los e2e siguen viendo `.tpl-c`, y `club-info.scss` la sigue usando como ancestro
 * (`:host-context(.tpl-c)`). El flujo de reserva ya NO: `booking-flow.scss` no tiene un solo
 * selector `.tpl-*` desde que se lo viste con los tokens `--flow-*` que declara `_tokens.scss` de
 * esta cáscara.
 *
 * Los dos modales son transversales a las plantillas y viven en `Landing`: la cáscara solo avisa
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

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  readonly tenantNombre = this.club.tenantNombre;
}
