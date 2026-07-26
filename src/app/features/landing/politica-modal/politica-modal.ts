import { Component, input, output } from '@angular/core';

/** Modal de la política de cancelación del club (texto libre, respeta saltos de línea). */
@Component({
  selector: 'app-politica-modal',
  templateUrl: './politica-modal.html',
  styleUrl: './politica-modal.scss',
})
export class PoliticaModal {
  readonly texto = input.required<string>();
  readonly cerrar = output<void>();
}
