import { Pipe, PipeTransform } from '@angular/core';

/**
 * Normaliza un teléfono argentino al formato que necesita wa.me: `549` + área + número,
 * solo dígitos. Pensado para `[href]="'https://wa.me/' + (telefono | waAr)"`.
 *
 *  - pelado:            3517505281        → 5493517505281
 *  - con 0 nacional:    03517505281       → 5493517505281
 *  - con código país:   +54 351 750 5281  → 5493517505281
 *  - con 549 (ideal):   5493517505281     → 5493517505281 (idempotente)
 *
 * Si no hay dígitos, devuelve '' (el template evita armar un link roto).
 */
export function toWhatsappAr(raw: string | null | undefined): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  return d ? '549' + d : '';
}

@Pipe({ name: 'waAr', standalone: true })
export class WhatsappArPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return toWhatsappAr(value);
  }
}
