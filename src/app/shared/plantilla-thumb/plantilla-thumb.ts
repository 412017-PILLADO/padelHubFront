import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CodigoConShell, PLANTILLAS } from '../../core/landing/plantillas';

/**
 * Miniatura tokenizada de una plantilla de landing: un afiche chico que usa `var(--court)` y
 * `var(--court-2)`, así el club se ve con SUS colores en las cuatro antes de elegir (spec §7).
 *
 * Sin imágenes y sin iframe, y las dos ausencias son decisiones y no comodidad. Una imagen se
 * desactualiza sola en cuanto una plantilla cambia y nadie se entera; un iframe por miniatura serían
 * cuatro landings enteras cargando atrás de un panel de configuración. Lo que sí es un costado
 * conocido y está dicho en la spec: la miniatura es un AFICHE, no la landing renderizada. Si una
 * plantilla cambia mucho, su silueta se actualiza a mano — para eso está el preview vivo al lado.
 *
 * Es CAPA 2 (spec §5.1): declara su propia superficie y su tinta —las saca del `esquema` del
 * registry, que a su vez está pineado contra la hoja real de cada cáscara en `plantillas.spec.ts`—
 * y NUNCA declara `--court*`, que es de la capa 3. Quien le pone el color es el contenedor: el panel
 * se lo pone desde el formulario y marketing desde sus swatches, y por eso la misma hoja sirve para
 * los dos sin una sola rama.
 *
 * SSR-safe a propósito: nada de `window` ni `document`. La sección de personalización de marketing
 * (spec §8) la va a reusar, y ésa sí se renderiza en el server.
 */
@Component({
  selector: 'plantilla-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plantilla-thumb.html',
  styleUrl: './plantilla-thumb.scss',
  host: {
    '[attr.data-tpl]': 'codigo()',
    '[attr.data-esquema]': 'ficha().esquema',
  },
})
export class PlantillaThumbComponent {
  /**
   * Qué plantilla dibujar. Sólo códigos CON cáscara (`CodigoConShell`, no `CodigoPlantilla`): una
   * miniatura de algo que no se puede elegir sería publicidad de un producto que no existe, y el
   * tipo lo hace imposible en compilación en vez de en una review.
   */
  readonly codigo = input.required<CodigoConShell>();

  /** La ficha entera del registry: el esquema sale de ahí, nunca de una lista escrita acá. */
  readonly ficha = computed(() => PLANTILLAS[this.codigo()]);

  /** La clase que elige la silueta. Deriva del código, así que una cáscara nueva entra sola con su
   *  bloque en la hoja y no hay ninguna lista que sincronizar. */
  readonly claseSilueta = computed(() => `t-${this.codigo().toLowerCase()}`);
}
