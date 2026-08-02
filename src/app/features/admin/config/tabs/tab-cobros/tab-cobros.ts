import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ConfigStateService } from '../../config-state.service';

/** Pestaña "Cobros": seña, política de cancelación y conexión con Mercado Pago. Sin inputs/outputs:
 *  el estado se comparte con el resto de la pantalla vía `ConfigStateService` (heredado por DI del
 *  provider del padre `ConfigComponent`).
 *
 *  El retorno del flujo OAuth de MP (`?mp=conectado`) se maneja en el padre (toca `location`/`history`
 *  y decide la pestaña activa); este componente sólo lee `mpEstado()` del servicio compartido, así que
 *  cuando el padre llama `cargarMpEstado()` tras el retorno, la card de acá se actualiza sola. */
@Component({
  selector: 'app-tab-cobros',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './tab-cobros.html',
  styleUrl: './tab-cobros.scss',
})
export class TabCobrosComponent {
  private readonly st = inject(ConfigStateService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly requiereSena = this.st.requiereSena;
  readonly senaMonto = this.st.senaMonto;
  readonly senaAlias = this.st.senaAlias;
  readonly politicaCancelacion = this.st.politicaCancelacion;
  readonly invalidSenaMonto = this.st.invalidSenaMonto;
  readonly invalidSenaAlias = this.st.invalidSenaAlias;
  readonly mpEstado = this.st.mpEstado;
  readonly mpBusy = this.st.mpBusy;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual ──
  readonly toggleSena = this.st.toggleSena.bind(this.st);
  readonly onSenaMontoInput = this.st.onSenaMontoInput.bind(this.st);
  readonly onSenaAliasInput = this.st.onSenaAliasInput.bind(this.st);
  readonly onPoliticaCancelacionInput = this.st.onPoliticaCancelacionInput.bind(this.st);

  // ── Mercado Pago ──
  conectarMp(): void {
    const returnTo = location.origin + '/admin/config';
    this.st.conectarMp(returnTo).subscribe({
      next: ({ url }) => (location.href = url),
      error: (err: HttpErrorResponse) => {
        this.messages.add({
          severity: 'error',
          summary: 'Mercado Pago',
          detail: err?.error?.error ?? 'No se pudo iniciar la conexión.',
        });
      },
    });
  }

  desconectarMp(): void {
    this.confirm.confirm({
      header: 'Desconectar Mercado Pago',
      message: '¿Desconectar Mercado Pago? Las señas dejarán de cobrarse online.',
      acceptLabel: 'Desconectar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.st.desconectarMp().subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Mercado Pago', detail: 'Cuenta desvinculada.' });
          },
          error: (err: HttpErrorResponse) => {
            this.messages.add({
              severity: 'error',
              summary: 'Mercado Pago',
              detail: err?.error?.error ?? 'No se pudo desconectar.',
            });
          },
        });
      },
    });
  }
}
