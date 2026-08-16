import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { BrandingService } from '../../../../../core/branding/branding.service';
import { inkOnAccent } from '../../../../../core/branding/tenant-colors';
import {
  CODIGOS_CON_SHELL,
  PLANTILLAS,
  shellDePlantilla,
} from '../../../../../core/landing/plantillas';
import { PlantillaThumbComponent } from '../../../../../shared/plantilla-thumb/plantilla-thumb';
import { ConfigStateService } from '../../config-state.service';
import { PreviewPlantillaComponent } from './preview-plantilla/preview-plantilla';

/** Pestaña "Tu club": marca (colores + logo + plantilla) y contacto/ubicación. Sin inputs/outputs:
 *  el estado se comparte con el resto de la pantalla vía `ConfigStateService` (heredado por DI del
 *  provider del padre `ConfigComponent`). */
@Component({
  selector: 'app-tab-club',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PlantillaThumbComponent, PreviewPlantillaComponent],
  templateUrl: './tab-club.html',
  styleUrl: './tab-club.scss',
})
export class TabClubComponent {
  private readonly st = inject(ConfigStateService);
  private readonly messages = inject(MessageService);
  private readonly branding = inject(BrandingService);

  /**
   * Las plantillas que el dueño puede elegir, derivadas del registry en vez de escritas a mano.
   * Era la 4ta copia de la misma constante, y estaba desactualizada en las dos puntas: no ofrecía la
   * E —construida y andando— y describía a la B como "hero centrado", que es lo que era antes de
   * volverse la nocturna.
   *
   * `CODIGOS_CON_SHELL` y no `CODIGOS_PLANTILLA`: el catálogo lista las cinco porque el back las
   * acepta, pero D todavía no tiene cáscara y `shellDePlantilla()` la manda a la A. Ofrecerla sería
   * dejar que el dueño elija algo que se ve como otra cosa. Cuando D exista, aparece sola.
   */
  readonly plantillas = CODIGOS_CON_SHELL.map((c) => ({
    value: c,
    label: `${c} · ${PLANTILLAS[c].nombre}`,
    hint: PLANTILLAS[c].descripcion,
  }));

  /**
   * La tinta legible sobre el color que el dueño está eligiendo AHORA. Sale de `inkOnAccent()`, la
   * misma función pura que decide la tinta del producto real (`core/branding/tenant-colors.ts`), y
   * no de un `#fff` fijo: un club amarillo con texto blanco encima es ilegible, y las miniaturas de
   * A y de E ponen texto sobre la masa de color.
   *
   * Va acá y no adentro de la miniatura porque la miniatura es CAPA 2 y no tiene por qué saber nada
   * del color del club: se lo pone el contenedor, exactamente como se lo va a poner la sección de
   * marketing (spec §8) desde sus swatches.
   */
  readonly tintaSobreColor = computed(() => inkOnAccent(this.st.marcaColor()));

  /**
   * Qué miniatura sale marcada. **No es `marcaPlantilla()` crudo, y la diferencia es un caso real y
   * no hipotético:** el tenant `demo` quedó guardado en `D`, la plantilla que el owner descartó y
   * que ya no tiene cáscara. Con el valor crudo, NINGUNA de las cuatro matcheaba y la galería salía
   * **sin nada seleccionado** — mientras la landing pública dibujaba la A, porque `shellDePlantilla()`
   * la manda ahí. O sea que el panel no le decía al dueño qué está viendo su jugador.
   *
   * `shellDePlantilla()` es exactamente la función que decide qué cáscara se dibuja, así que marcar
   * lo que ella devuelve es marcar LA VERDAD. El `<select>` viejo tenía el mismo agujero y lo
   * mostraba como un desplegable en blanco.
   *
   * No se toca el valor guardado: mostrar A no lo persiste. Si el dueño guarda sin elegir, sigue
   * guardado lo que había — reescribirle en silencio la plantilla al cargar la pantalla sería
   * cambiarle un dato por haber entrado a mirar.
   */
  readonly plantillaDibujada = computed(() => shellDePlantilla(this.st.marcaPlantilla()));

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly marcaColor = this.st.marcaColor;
  readonly marcaColorSec = this.st.marcaColorSec;
  readonly marcaColorSecPicker = this.st.marcaColorSecPicker;
  readonly marcaPlantilla = this.st.marcaPlantilla;
  readonly uploadingLogo = this.st.uploadingLogo;
  readonly logoPreview = this.st.logoPreview;
  readonly direccion = this.st.direccion;
  readonly whatsapp = this.st.whatsapp;
  readonly mapaUrl = this.st.mapaUrl;
  readonly instagram = this.st.instagram;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual ──
  readonly setMarcaColor = this.st.setMarcaColor.bind(this.st);
  readonly setColorSec = this.st.setColorSec.bind(this.st);
  readonly clearColorSec = this.st.clearColorSec.bind(this.st);
  readonly setMarcaPlantilla = this.st.setMarcaPlantilla.bind(this.st);
  readonly setDireccion = this.st.setDireccion.bind(this.st);
  readonly setWhatsapp = this.st.setWhatsapp.bind(this.st);
  readonly setMapaUrl = this.st.setMapaUrl.bind(this.st);
  readonly setInstagram = this.st.setInstagram.bind(this.st);

  /** Sube el logo elegido en el input file. Valida tipo/tamaño antes de mandar. */
  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    const okTipo = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type);
    if (!okTipo) {
      this.messages.add({ severity: 'warn', summary: 'Formato no soportado', detail: 'Usá PNG, JPG, WEBP o SVG.' });
      return;
    }
    if (file.size > 512 * 1024) {
      this.messages.add({ severity: 'warn', summary: 'Muy pesado', detail: 'El logo debe pesar menos de 512 KB.' });
      return;
    }
    this.st.uploadLogo(file).subscribe({
      next: (m) => {
        // Refleja el logo nuevo en la nav del panel al instante.
        this.branding.apply(this.st.marcaColor(), this.st.marcaColorSec(), m.logoUrl);
        this.messages.add({ severity: 'success', summary: 'Logo actualizado', detail: 'Ya se ve en tu página.' });
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos subir el logo.' });
      },
    });
  }

  /** Quita el logo del club (vuelve a mostrarse solo el nombre). */
  removeLogo(): void {
    this.st.removeLogo().subscribe({
      next: (m) => {
        // Vuelve a mostrar el ícono/nombre por defecto en la nav.
        this.branding.apply(this.st.marcaColor(), this.st.marcaColorSec(), m.logoUrl);
        this.messages.add({ severity: 'success', summary: 'Logo quitado', detail: 'Se muestra solo el nombre.' });
      },
      error: () => {
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No pudimos quitar el logo.' });
      },
    });
  }
}
