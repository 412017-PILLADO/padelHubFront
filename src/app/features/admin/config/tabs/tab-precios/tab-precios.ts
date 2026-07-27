import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfigStateService } from '../../config-state.service';

function timeOptions(): string[] {
  const arr: string[] = [];
  for (let m = 7 * 60; m <= 24 * 60; m += 30) {
    const h = String(Math.floor(m / 60) % 24).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    arr.push(`${h}:${mm}`);
  }
  return arr;
}

/** Pestaña "Precios": precio general/por cancha y precio por horario (franjas de ajuste porcentual).
 *  Sin inputs/outputs: el estado se comparte con el resto de la pantalla vía `ConfigStateService`
 *  (heredado por DI del provider del padre `ConfigComponent`). Ningún handler de acá mezcla toast/
 *  confirm, así que no hace falta inyectar `MessageService`/`ConfirmationService`. */
@Component({
  selector: 'app-tab-precios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './tab-precios.html',
  styleUrl: './tab-precios.scss',
})
export class TabPreciosComponent {
  private readonly st = inject(ConfigStateService);

  readonly times = timeOptions();

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly precioModo = this.st.precioModo;
  readonly precioHoraGeneral = this.st.precioHoraGeneral;
  readonly invalidPrecio = this.st.invalidPrecio;
  readonly canchasSinPrecio = this.st.canchasSinPrecio;
  readonly precioFranjas = this.st.precioFranjas;
  readonly precioFranjasError = this.st.precioFranjasError;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual ──
  readonly setPrecioModo = this.st.setPrecioModo.bind(this.st);
  readonly onPrecioGeneralInput = this.st.onPrecioGeneralInput.bind(this.st);
  readonly addFranja = this.st.addFranja.bind(this.st);
  readonly removeFranja = this.st.removeFranja.bind(this.st);
  readonly setFranjaDesde = this.st.setFranjaDesde.bind(this.st);
  readonly setFranjaHasta = this.st.setFranjaHasta.bind(this.st);
  readonly setFranjaTipo = this.st.setFranjaTipo.bind(this.st);
  readonly onFranjaPctInput = this.st.onFranjaPctInput.bind(this.st);

  /** Etiqueta de una hora en el select de cierre: aclara que "00:00" es medianoche (24:00). */
  timeLabel(t: string): string {
    return t === '00:00' ? '00:00 (medianoche)' : t;
  }
}
