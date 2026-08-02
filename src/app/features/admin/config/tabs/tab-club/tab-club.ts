import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { BrandingService } from '../../../../../core/branding/branding.service';
import { ConfigStateService } from '../../config-state.service';

/** Pestaña "Tu club": marca (colores + logo + plantilla) y contacto/ubicación. Sin inputs/outputs:
 *  el estado se comparte con el resto de la pantalla vía `ConfigStateService` (heredado por DI del
 *  provider del padre `ConfigComponent`). */
@Component({
  selector: 'app-tab-club',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './tab-club.html',
  styleUrl: './tab-club.scss',
})
export class TabClubComponent {
  private readonly st = inject(ConfigStateService);
  private readonly messages = inject(MessageService);
  private readonly branding = inject(BrandingService);

  readonly plantillas = [
    { value: 'A', label: 'A · Poster', hint: 'Afiche a un lado + reserva' },
    { value: 'B', label: 'B · Hero centrado', hint: 'Marca grande centrada, más comercial' },
    { value: 'C', label: 'C · Compacta (app)', hint: 'Barra lateral + grilla, directo a reservar' },
  ];

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
