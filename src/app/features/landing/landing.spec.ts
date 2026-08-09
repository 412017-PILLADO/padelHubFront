import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Landing } from './landing';
import { BookingService } from '../../core/api/booking.service';

/**
 * Regresión del Critical de la review de la Task 1: el effect que reacciona a
 * `club.estadoCarga()` (hoy en el constructor de `BookingStore`, que `Landing` provee) leía
 * `duracionElegida()` como signal DENTRO de sus ramas. Angular trackea eso como dependencia del effect, así que un click de duración
 * DESPUÉS de que la config ya resolvió (éxito o error) volvía a disparar el effect completo:
 * `initDefaultDay()` corría una segunda vez y, en el camino de error, el toast se repetía.
 *
 * El fix baja `duracionElegida` a un campo común (no signal) y agrega un guard de "último estado
 * atendido" en el propio effect. Este test reproduce el escenario exacto que describe la review:
 * config falla → el visitante clickea una duración → el toast de error NO debe repetirse.
 *
 * Se mantiene apuntando a `Landing` a propósito, aunque el effect ya viva en `BookingStore`: así
 * cubre también el cableado real (el componente provee ClubStore + BookingStore + MessageService y
 * el click entra por el alias `pickDuracion` que usa landing.html).
 */
describe('Landing — effect de estadoCarga', () => {
  it('un click de duración después de que la config falló no repite el toast de error', () => {
    const bookingDouble = {
      config: () => throwError(() => new Error('falló el fetch')),
      disponibilidad: () => of([]),
    };
    TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([]), { provide: BookingService, useValue: bookingDouble }],
    });

    const fixture = TestBed.createComponent(Landing);
    // MessageService es un provider del propio Component (`providers: [MessageService, ...]`),
    // así que se toma la instancia real del injector del componente, no una pisada del módulo.
    const messages = fixture.debugElement.injector.get(MessageService);
    const addSpy = vi.spyOn(messages, 'add');

    // El constructor deja el effect agendado (Angular difiere su primera corrida); lo flusheamos.
    TestBed.tick();
    expect(addSpy).toHaveBeenCalledTimes(1); // el toast de "no pudimos cargar la configuración"

    // El visitante clickea una duración DESPUÉS de que la config ya falló y el toast ya salió.
    fixture.componentInstance.pickDuracion(60);
    TestBed.tick();

    // Con el bug (duracionElegida como signal leída dentro del effect), este click reagendaba el
    // effect completo y el toast salía de nuevo. Con el fix, estadoCarga() no cambió → el effect
    // no tiene motivo para volver a correr → sigue en 1.
    expect(addSpy).toHaveBeenCalledTimes(1);
  });
});
