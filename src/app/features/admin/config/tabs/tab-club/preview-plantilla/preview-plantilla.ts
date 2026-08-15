import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { urlPreviewLanding } from '../../../../../../core/landing/preview-url';

/** Los dos anchos del toggle. El teléfono es el default por spec §7. */
export type MarcoPreview = 'telefono' | 'escritorio';

/**
 * Preview vivo de la plantilla elegida: la landing REAL del club adentro de un iframe, con la
 * plantilla y el color que el dueño está eligiendo ahora aunque todavía no haya guardado.
 *
 * UNO solo, y las otras tres plantillas se muestran con las miniaturas: cuatro iframes serían cuatro
 * landings enteras cargando atrás de un formulario de configuración.
 *
 * ARRANCA EN TELÉFONO, y no es un default cómodo: la fase D midió que una plantilla puede leerse
 * bien a 1280 y no leerse a 390 (le pasó a la plantilla D, que por eso se descartó). El producto se
 * usa mayormente en el teléfono, así que arrancar en escritorio sería mostrarle al dueño el ancho
 * que sus jugadores casi no usan.
 */
@Component({
  selector: 'app-preview-plantilla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-plantilla.html',
  styleUrl: './preview-plantilla.scss',
})
export class PreviewPlantillaComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  readonly plantilla = input.required<string>();
  readonly color = input.required<string>();
  readonly colorSec = input<string | null>(null);

  /** Teléfono por default (spec §7). */
  readonly marco = signal<MarcoPreview>('telefono');
  setMarco(m: MarcoPreview): void {
    this.marco.set(m);
  }

  /**
   * El href crudo. Existe separado del `src` sanitizado porque un `SafeResourceUrl` es un objeto
   * opaco: sin esto, nada podría leer la URL para verificarla — ni un test ni el propio e2e.
   *
   * `urlPreviewLanding()` es quien resuelve el host del tenant, que es donde está la trampa: un
   * `/?plantilla=…` relativo mostraría la landing de MARKETING en desarrollo (ver preview-url.ts).
   */
  readonly href = computed(() =>
    urlPreviewLanding(this.doc.location.href, {
      plantilla: this.plantilla(),
      color: this.color(),
      colorSec: this.colorSec(),
    }),
  );

  /**
   * Angular exige marcar el `src` de un iframe como confiable, y acá lo es: sale de
   * `urlPreviewLanding()`, que arma la URL a partir del host donde YA está corriendo el panel y de
   * dos colores que el propio formulario valida. No hay nada que el usuario escriba libremente.
   */
  readonly src = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.href()),
  );
}
