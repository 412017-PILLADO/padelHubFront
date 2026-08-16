import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { inkOnAccent } from '../../../core/branding/tenant-colors';
import { CODIGOS_CON_SHELL, PLANTILLAS } from '../../../core/landing/plantillas';
import { PlantillaThumbComponent } from '../../../shared/plantilla-thumb/plantilla-thumb';

/** Un club de ejemplo: el par de colores que el visitante puede probar. */
interface ClubDeMuestra {
  readonly nombre: string;
  readonly primario: string;
  readonly secundario: string;
}

/**
 * "Tu marca · Tu club, con tu cara" — la sección de la landing de marketing que en vez de AFIRMAR
 * que el producto es personalizable, lo demuestra (spec §8).
 *
 * El problema que arregla es medible: `grep -rniE "plantilla|diseñ"` sobre `features/marketing/`
 * daba **cero resultados**. El producto tiene cuatro diseños construidos y la página que lo vende no
 * los nombraba; lo más cerca que llegaba era una card que dice "Tu marca, tu página" y enumera
 * nombre, logo y color — las tres afirmadas, ninguna mostrada, y la plantilla ni mencionada.
 *
 * Reusa la MISMA `<plantilla-thumb>` de la galería del panel, y eso es lo que hace que la sección no
 * se desactualice sola: si una plantilla cambia su silueta, cambia acá también. Sin una imagen, que
 * es lo que la spec pide y el motivo es el mismo — una captura envejece en silencio.
 *
 * EL COLOR SE ESCRIBE EN LA ZONA DE LA SECCIÓN, NO EN EL `<html>`. Es la restricción de la spec y no
 * es un detalle: escribirlo en el documento teñiría la nav, los botones y el pie de Padel-HUB con el
 * color de un club que no existe, y quedaría pegado al navegar.
 */
@Component({
  selector: 'app-marca-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlantillaThumbComponent],
  templateUrl: './marca-demo.html',
  styleUrl: './marca-demo.scss',
})
export class MarcaDemoComponent {
  /**
   * Los clubes de muestra. Son colores PLAUSIBLES de club, y a propósito no están los extremos con
   * los que se miden las cáscaras (el casi blanco y el casi negro): esos existen para encontrar
   * degradaciones —el casi blanco lava el campo de C y de E— y mostrarlos acá sería enseñar el
   * producto en su peor día. Quien necesita ver su color exacto lo tiene en el preview vivo del
   * panel, que muestra la landing de verdad.
   */
  readonly clubes: readonly ClubDeMuestra[] = [
    { nombre: 'Teal', primario: '#0a8a99', secundario: '#12b3c6' },
    { nombre: 'Naranja', primario: '#f97316', secundario: '#fb923c' },
    { nombre: 'Amarillo', primario: '#ffd400', secundario: '#ff8a00' },
    { nombre: 'Fucsia', primario: '#ff2d95', secundario: '#7c3aed' },
    { nombre: 'Verde', primario: '#16a34a', secundario: '#84cc16' },
    { nombre: 'Azul', primario: '#1d4ed8', secundario: '#38bdf8' },
  ];

  /**
   * Las plantillas con cáscara, con su ficha del registry para el pie de cada miniatura. Sale de
   * `CODIGOS_CON_SHELL` y no de una lista acá: es el error que este código ya cometió tres veces.
   *
   * El `codigo` va SUELTO y no desestructurado de la ficha a propósito: así conserva el tipo angosto
   * `CodigoConShell` que `<plantilla-thumb>` exige, y ofrecer una plantilla sin cáscara deja de
   * compilar en vez de descubrirse en pantalla.
   */
  readonly plantillas = CODIGOS_CON_SHELL.map((codigo) => ({
    codigo,
    ficha: PLANTILLAS[codigo],
  }));

  readonly elegido = signal(this.clubes[0]);
  elegir(club: ClubDeMuestra): void {
    this.elegido.set(club);
  }

  /** La tinta legible sobre el color elegido, de la función pura del branding real. Un club amarillo
   *  con texto blanco encima es ilegible, y dos de las cuatro siluetas ponen tinta sobre el color. */
  readonly tinta = computed(() => inkOnAccent(this.elegido().primario));
}
