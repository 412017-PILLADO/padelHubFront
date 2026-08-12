import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ClubStore } from '../club.store';

/**
 * Pie único de todas las plantillas: © del club + los links de arrepentimiento (Res. 424/2020),
 * política de cancelación y panel. Antes estaba copiado una vez por plantilla en `landing.html`,
 * idéntico salvo la clase del contenedor.
 *
 * Esa clase (`pb-foot` / `b-foot` / `c-foot` / `e-foot`) sigue siendo responsabilidad de la
 * cáscara: se pone sobre el host y desde la hoja de cada cáscara (ver shells/) le da a cada
 * plantilla su borde, su padding y su lugar en el layout. Acá viven `:host` con lo que todas
 * comparten y el interior del pie.
 *
 * Los dos modales (arrepentimiento y política) son transversales y viven en `Landing`: el pie solo
 * avisa que hay que abrirlos — mismo contrato que ya usa `<app-booking-flow>`.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-landing-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './landing-footer.html',
  styleUrl: './landing-footer.scss',
  // El pie era un <footer> en cada plantilla; el host es un elemento desconocido, que no tiene rol
  // implícito. Sin esto la página se queda sin landmark de pie para lectores de pantalla.
  host: { role: 'contentinfo' },
})
export class LandingFooterComponent {
  private readonly club = inject(ClubStore);

  readonly abrirArrepentimiento = output<void>();
  readonly abrirPolitica = output<void>();

  readonly config = this.club.config;
  readonly tenantNombre = this.club.tenantNombre;
}
