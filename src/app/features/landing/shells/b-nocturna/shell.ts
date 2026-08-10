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
 * Cáscara de la plantilla B (hero centrado sobre vidrio translúcido): nav con la marca, héroe,
 * el flujo de reserva y la info del club en tarjetas.
 *
 * El `<div class="tpl-b">` que envolvía todo en `landing.html` es ahora el host (`host: { class }`):
 * los e2e siguen viendo `.tpl-b`, y `club-info.scss` la sigue usando como ancestro
 * (`:host-context(.tpl-b)`). El flujo de reserva ya NO: `booking-flow.scss` no tiene un solo
 * selector `.tpl-*` desde que se lo viste con los tokens `--flow-*` que declara `_tokens.scss` de
 * esta cáscara.
 *
 * Los dos modales son transversales a las 3 plantillas y viven en `Landing`: la cáscara solo avisa
 * que hay que abrirlos — mismo contrato que ya usan `<app-booking-flow>` y `<app-landing-footer>`.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-shell-b',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingFlowComponent, BrandMarkComponent, ClubInfoComponent, LandingFooterComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { class: 'tpl-b' },
})
export class ShellBComponent {
  private readonly club = inject(ClubStore);
  private readonly doc = inject(DOCUMENT);

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  readonly tenantNombre = this.club.tenantNombre;

  constructor() {
    // Primera cáscara con par tipográfico propio (spec §6.2), y por eso la primera que enchufa
    // `cargarFuentes()`: hasta acá ninguna hoja del repo referenciaba las familias del registry, así
    // que inyectar sólo agregaba peso. B sí las usa — shell.scss declara --display/--body/--mono con
    // Anton/Inter Tight/JetBrains Mono.
    // Corre también en SSR (el DOCUMENT inyectado se serializa), así que el HTML que sale del server
    // ya pide la tipografía de B y la plantilla no parpadea con la fuente de plataforma hasta que
    // hidrata. `cargarFuentes` es idempotente por URL: al hidratar no duplica el <link> del server.
    cargarFuentes(this.doc, urlFuentes(PLANTILLAS.B.fuentes));
  }
}
