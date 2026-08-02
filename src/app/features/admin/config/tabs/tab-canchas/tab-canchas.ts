import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CanchaConfig } from '../../../../../core/api/booking.service';
import { ConfigStateService } from '../../config-state.service';

/** Tipos de cerramiento de la cancha (espeja el enum TipoPared del backend). */
const TIPO_PARED_OPCIONES = [
  { label: 'Cristal', value: 'CRISTAL' },
  { label: 'Muro', value: 'MURO' },
  { label: 'Mixta', value: 'MIXTA' },
];

/** Pestaña "Canchas": CRUD de canchas (alta/edición/baja) + elección de cancha (autoasignación).
 *  Sin inputs/outputs: el estado se comparte con el resto de la pantalla vía `ConfigStateService`
 *  (heredado por DI del provider del padre `ConfigComponent`).
 *
 *  `saveCancha`/`toggleCanchaEstado`/`askDeleteCancha` mezclan estado con toast/ConfirmDialog (la
 *  baja y la desactivación piden confirmación), así que quedan acá en vez de en el servicio: la
 *  mutación de estado vive en `ConfigStateService` y devuelve el Observable, acá sólo se decide
 *  qué toast mostrar. */
@Component({
  selector: 'app-tab-canchas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule],
  templateUrl: './tab-canchas.html',
  styleUrl: './tab-canchas.scss',
})
export class TabCanchasComponent {
  private readonly st = inject(ConfigStateService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly tipoParedOpciones = TIPO_PARED_OPCIONES;

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly precioModo = this.st.precioModo;
  readonly autoasignacion = this.st.autoasignacion;
  readonly editingCanchaId = this.st.editingCanchaId;
  readonly canchaFormOpen = this.st.canchaFormOpen;
  readonly cNombre = this.st.cNombre;
  readonly cOrden = this.st.cOrden;
  readonly cTechada = this.st.cTechada;
  readonly cTipoPared = this.st.cTipoPared;
  readonly cPrecio = this.st.cPrecio;
  readonly cColor = this.st.cColor;
  readonly canchaTogglingId = this.st.canchaTogglingId;
  readonly canchasOrdenadas = this.st.canchasOrdenadas;
  readonly canCanchaSave = this.st.canCanchaSave;
  readonly canchasSinPrecio = this.st.canchasSinPrecio;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual (mismo nombre público) ──
  readonly toggleAutoasignacion = this.st.toggleAutoasignacion.bind(this.st);
  readonly startNewCancha = this.st.startNewCancha.bind(this.st);
  readonly editCancha = this.st.editCancha.bind(this.st);
  readonly cancelCanchaEdit = this.st.cancelCanchaEdit.bind(this.st);

  // ── Canchas ──
  saveCancha(): void {
    if (!this.st.canCanchaSave()) return;
    const creando = this.st.editingCanchaId() == null;
    this.st.saveCancha().subscribe({
      next: (saved) => {
        this.messages.add({
          severity: 'success',
          summary: creando ? 'Cancha creada' : 'Cancha actualizada',
          detail: saved.nombre,
        });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos guardar la cancha. Probá de nuevo.',
        });
      },
    });
  }

  /** Activa/desactiva una cancha. Al desactivar, pide confirmación (deja de ofrecerse, no borra reservas). */
  toggleCanchaEstado(c: CanchaConfig): void {
    const activando = c.estado !== 'ACTIVO';
    if (!activando) {
      this.confirm.confirm({
        header: 'Desactivar cancha',
        message: `¿Desactivar "${c.nombre}"? Deja de ofrecerse al público para reservar; las reservas ya hechas se conservan.`,
        acceptLabel: 'Desactivar',
        rejectLabel: 'Volver',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => this.doToggleCanchaEstado(c, 'INACTIVO'),
      });
    } else {
      this.doToggleCanchaEstado(c, 'ACTIVO');
    }
  }

  private doToggleCanchaEstado(c: CanchaConfig, estado: string): void {
    this.st.cambiarEstadoCancha(c, estado).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: estado === 'ACTIVO' ? 'Activada' : 'Desactivada',
          detail: c.nombre,
        });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cambiar el estado de la cancha. Probá de nuevo.',
        });
      },
    });
  }

  askDeleteCancha(c: CanchaConfig): void {
    this.confirm.confirm({
      header: 'Eliminar cancha',
      message: `¿Eliminar la cancha "${c.nombre}"? Las reservas ya hechas se conservan.`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDeleteCancha(c),
    });
  }

  private doDeleteCancha(c: CanchaConfig): void {
    this.st.eliminarCancha(c).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Eliminada', detail: c.nombre });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos eliminar la cancha. Probá de nuevo.',
        });
      },
    });
  }

  tipoParedLabel(value: string | null): string {
    return this.tipoParedOpciones.find((o) => o.value === value)?.label ?? (value ?? '—');
  }
}
