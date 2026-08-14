import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, output } from '@angular/core';

import { ClubStore } from '../../club.store';
import { BookingFlowComponent } from '../../booking/booking-flow';
import { LandingFooterComponent } from '../../club/landing-footer';

/**
 * Cáscara de la plantilla A (afiche, la default): columna izquierda con la marca, el héroe y la
 * info del club sobre el color del tenant; columna derecha con el flujo de reserva.
 *
 * El `<div class="poster">` que envolvía todo en `landing.html` es ahora el host
 * (`host: { class: 'poster' }`): los e2e siguen viendo `.poster`.
 *
 * No usa `<app-club-info>` ni `<app-brand-mark>`: la A tiene su propia versión bespoke de las dos
 * cosas (`.brand-logo`, `.info-block/.hours/.link-row`), que es justo lo que la distingue de B y C.
 * Se unifican en el Plan 2, cuando se pueda comparar el pixel.
 *
 * Los dos modales son transversales a las 3 plantillas y viven en `Landing`: la cáscara solo avisa
 * que hay que abrirlos — mismo contrato que ya usan `<app-booking-flow>` y `<app-landing-footer>`.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-shell-a',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingFlowComponent, LandingFooterComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { class: 'poster' },
})
export class ShellAComponent {
  private readonly club = inject(ClubStore);
  /** La landing se renderiza también en el server: nada de `window` sin este guard. */
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  // Alias con los nombres que ya usaba landing.html: el template se movió verbatim.
  readonly tenantNombre = this.club.tenantNombre;
  readonly tenantPrimerNombre = this.club.tenantPrimerNombre;
  readonly logoSrc = this.club.logoSrc;
  readonly horarios = this.club.horarios;
  readonly direccion = this.club.direccion;
  readonly mapaUrl = this.club.mapaUrl;
  readonly whatsappUrl = this.club.whatsappUrl;
  readonly instagramHandle = this.club.instagramHandle;
  readonly instagramUrl = this.club.instagramUrl;

  openMaps(): void {
    const url = this.mapaUrl();
    if (url && this.esNavegador) window.open(url, '_blank');
  }
}
