import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject } from '@angular/core';

import { ClubStore } from '../club.store';

/**
 * Info del club (horarios + dónde estamos + contacto) como tarjetas, reusada por las plantillas B y
 * C. La plantilla A tiene su propia versión bespoke (`.info-block/.hours/.link-row`, todavía en
 * `landing.html`): se unifica en el Plan 2, cuando se pueda comparar el pixel.
 *
 * El host es `display: contents` a propósito: las `.ic-card` son items de la grilla que declara la
 * cáscara (`.b-info` / `.c-info`). Si el host fuese una caja, la grilla pasaría a tener UN hijo y
 * las tres tarjetas se apilarían dentro de una sola celda.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-club-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './club-info.html',
  styleUrl: './club-info.scss',
})
export class ClubInfoComponent {
  private readonly club = inject(ClubStore);
  /** La landing se renderiza también en el server: nada de `window` sin este guard. */
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  // Alias con los nombres que ya usaba landing.html: el template se movió verbatim.
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
