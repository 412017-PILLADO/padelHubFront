import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ClubStore } from '../club.store';

/**
 * Marca reutilizable (logo del club o el de Padel Hub por defecto) para las plantillas B, C y E. La
 * A tiene su propio bloque de marca en el afiche (`.brand-logo`, otro tamaño y otra alineación).
 *
 * Host en `display: contents`: la marca es un item del flex de la cáscara (`.b-brandline` /
 * `.c-brandline` / `.e-brandline`), así que el host no puede meter una caja intermedia sin correr
 * el logo.
 *
 * No provee `ClubStore`: lo toma del injector de `Landing`, que es quien lo declara.
 */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (logoSrc(); as logo) {
      <span class="tpl-logo"><img [src]="logo" [alt]="tenantNombre()" /></span>
    } @else {
      <span class="tpl-logo"><img src="logo-padelhub.png" alt="Padel Hub" /></span>
    }
  `,
  styles: `
    :host { display: contents; }

    /* Hoy ningún markup emite \`.tpl-mark\` (el fallback sin logo pasó a ser el logo de Padel Hub):
       las reglas se mueven tal cual desde landing.scss, la limpieza es del Plan 2. */
    .tpl-mark { display: inline-flex; width: 40px; height: 40px; color: var(--court); --paddle-grip: var(--court-2, var(--court-deep)); }
    .tpl-mark svg { width: 100%; height: 100%; }
    .tpl-logo { display: inline-flex; align-items: center; }
    .tpl-logo img { height: 40px; width: auto; max-width: 160px; object-fit: contain; display: block; }

    /* Lo que cada cáscara le ajusta a la marca desde afuera. Vive acá porque, encapsulada,
       \`.b-brandline .tpl-logo img\` ya no casaría con el DOM de este componente. */
    :host-context(.b-brandline) .tpl-mark { width: 30px; height: 30px; }
    /* El logo cede ancho: el nombre del club va al lado siempre, también en mobile. */
    :host-context(.b-brandline) .tpl-logo img { height: 32px; max-width: 120px; }
    /* B es la plantilla oscura y acá NO va ningún ajuste de color. Medido, no supuesto:
       - El logo del CLUB no se toca nunca: es su marca, y el club eligió el fondo oscuro al elegir
         la plantilla.
       - El fallback (\`logo-padelhub.png\`, la rama @else de arriba) tampoco hace falta tocarlo: no
         es tinta oscura como se creía, es un teal sobre alfa transparente. La tinta que entró a la
         cuenta es la media de los pixeles del PNG ponderada por alfa, rgb(4,144,163) = #0490a3 (no
         confundir con \`--court\`, el teal de plataforma, que es #0a8a99: son dos números distintos
         y acá vale el del archivo). Contra el vidrio de \`.b-nav\` da entre 3,9:1 y 4,9:1 según el
         color del club (medido con los cuatro extremos: teal 4,40 · fucsia 4,65 · negro 4,92 ·
         amarillo 3,92). Los cuatro
         pasan el umbral 3:1 de objeto gráfico (WCAG 1.4.11): el logo no desaparece.
       - Invertirlo sería peor: \`invert(1) brightness(1.6)\` lleva ese teal a un salmón
         rgb(255,178,147). Eso no es el logo de Padel Hub en oscuro, es otro logo. */

    :host-context(.c-brandline) .tpl-mark { width: 30px; height: 30px; }
    /* El logo cede ancho: el nombre va al lado siempre, y en el rail de 280px hay que repartir. */
    :host-context(.c-brandline) .tpl-logo img { height: 30px; max-width: 104px; }
  `,
})
export class BrandMarkComponent {
  private readonly club = inject(ClubStore);

  readonly logoSrc = this.club.logoSrc;
  readonly tenantNombre = this.club.tenantNombre;
}
