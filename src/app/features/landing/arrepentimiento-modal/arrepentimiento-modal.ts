import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { BookingService } from '../../../core/api/booking.service';

/** Modal del botón de arrepentimiento (Res. 424/2020). Autocontenido: form sin registro,
 *  honeypot y código de revocación. La landing solo controla su visibilidad. */
@Component({
  selector: 'app-arrepentimiento-modal',
  imports: [FormsModule],
  templateUrl: './arrepentimiento-modal.html',
  styleUrl: './arrepentimiento-modal.scss',
})
export class ArrepentimientoModal {
  private readonly booking = inject(BookingService);
  /** Provisto por Landing (ver providers: [MessageService] en landing.ts) — comparte el mismo
   *  <p-toast> del footer, no crea uno propio. */
  private readonly messages = inject(MessageService);

  readonly cerrar = output<void>();

  readonly nombre = signal('');
  readonly whatsapp = signal('');
  readonly detalle = signal('');
  /** Honeypot anti-bot (input oculto por CSS, mismo patrón que el form de reserva). */
  readonly empresa = signal('');
  readonly codigo = signal<string | null>(null);
  readonly busy = signal(false);

  enviar(): void {
    this.busy.set(true);
    this.booking
      .crearArrepentimiento({
        nombre: this.nombre().trim(),
        whatsapp: this.whatsapp().trim(),
        detalle: this.detalle().trim() || undefined,
        empresa: this.empresa(),
      })
      .subscribe({
        next: ({ codigo }) => {
          this.busy.set(false);
          this.codigo.set(codigo);
        },
        error: () => {
          this.busy.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No pudimos registrar tu solicitud. Probá de nuevo.',
          });
        },
      });
  }
}
