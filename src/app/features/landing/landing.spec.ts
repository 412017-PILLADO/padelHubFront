import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Landing } from './landing';
import { BookingStore } from './booking/booking.store';
import { BookingService, PublicConfig } from '../../core/api/booking.service';
import { CODIGOS_CON_SHELL, PLANTILLAS } from '../../core/landing/plantillas';

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
 * cubre también el cableado real (el componente provee ClubStore + BookingStore + MessageService, y
 * el click se toma del MISMO `BookingStore` del árbol, que es el que inyecta el `<app-booking-flow>`
 * de la cáscara — el mismo objeto contra el que corre el effect).
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
    // El click entra por el store (es lo que hace el botón de `<app-booking-flow>`); el store es el
    // que provee `Landing`, o sea el dueño del effect que este test vigila.
    const store = fixture.debugElement.injector.get(BookingStore);
    store.pickDuracion(60);
    TestBed.tick();

    // Con el bug (duracionElegida como signal leída dentro del effect), este click reagendaba el
    // effect completo y el toast salía de nuevo. Con el fix, estadoCarga() no cambió → el effect
    // no tiene motivo para volver a correr → sigue en 1.
    expect(addSpy).toHaveBeenCalledTimes(1);
  });
});

/** Config pública mínima y válida, con la plantilla que pida cada test. */
function configConPlantilla(plantilla: string): PublicConfig {
  return {
    tenant: {
      nombre: 'Club Test', colorPrimario: '#112233', colorSecundario: null, fuente: '',
      logoUrl: null, mostrarPrecios: false, requiereTelefono: true, plantilla,
    },
    complejo: {
      id: 1, nombre: 'Club Test', direccion: null, telefono: null, whatsapp: null,
      mapaUrl: null, instagram: null,
    },
    pasoMinutos: 30,
    duracionesPermitidas: [60, 90],
    duracionDefault: 90,
    permitirOtrasDuraciones: true,
    requiereSena: false, senaMonto: null, senaAlias: null,
    autoasignacion: false, pagoOnline: false,
    politicaCancelacion: null,
    precioFranjas: [],
    canchas: [],
    horarios: [],
  };
}

/** Monta la landing de un tenant que eligió `plantilla` y devuelve el host ya renderizado. */
function montarLanding(plantilla: string): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Landing],
    providers: [
      provideRouter([]),
      {
        provide: BookingService,
        useValue: { config: () => of(configConPlantilla(plantilla)), disponibilidad: () => of([]) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Landing);
  TestBed.tick();
  return fixture.nativeElement as HTMLElement;
}

/**
 * El host de la landing publica el código de la cáscara que realmente se dibuja, no el que eligió
 * el club. Importa porque `landing.scss` engancha el layout por atributo:
 * `:host([data-tpl='A']) { height: 100svh; overflow: hidden }` es lo que clava el viewport del
 * afiche. El back ya acepta los cinco códigos pero D todavía no tiene cáscara: si un
 * tenant en D publicara `data-tpl="D"` y se dibujara la A, la A quedaría con su `height: 100svh`
 * adentro de un host sin clamp ni `overflow: hidden`, o sea con doble scroll.
 */
describe('Landing — plantilla y cáscara', () => {
  it('un tenant en D dibuja la cáscara A y el host publica data-tpl="A"', () => {
    const host = montarLanding('D');

    expect(host.querySelector('app-shell-a')).not.toBeNull();
    expect(host.querySelector('app-shell-b')).toBeNull();
    expect(host.querySelector('app-shell-c')).toBeNull();
    expect(host.querySelector('app-shell-e')).toBeNull();
    // Lo que hace que las reglas de la A enganchen:
    expect(host.getAttribute('data-tpl')).toBe('A');
    expect(host.querySelector('app-shell-a')!.classList).toContain(PLANTILLAS.A.claseShell);
  });

  it('un código que el catálogo no conoce también cae en la A', () => {
    const host = montarLanding('ZZ');

    expect(host.querySelector('app-shell-a')).not.toBeNull();
    expect(host.getAttribute('data-tpl')).toBe('A');
  });

  /**
   * `claseShell` del registry no la consume nadie todavía (cada cáscara declara su clase en el
   * `host` del decorador, que es estático a propósito). Sin este test las dos podrían separarse en
   * silencio: los e2e buscan `.poster`/`.tpl-b`/`.tpl-c` literales y seguirían pasando.
   */
  it.each(CODIGOS_CON_SHELL)(
    'la plantilla %s dibuja su cáscara con la clase que declara el registry',
    (codigo) => {
      const host = montarLanding(codigo);
      const shell = host.querySelector(`app-shell-${codigo.toLowerCase()}`);

      expect(shell).not.toBeNull();
      expect(host.getAttribute('data-tpl')).toBe(codigo);
      expect(shell!.classList).toContain(PLANTILLAS[codigo].claseShell);
    }
  );
});
