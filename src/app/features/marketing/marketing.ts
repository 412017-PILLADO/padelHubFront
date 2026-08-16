import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { MarcaDemoComponent } from './marca-demo/marca-demo';

interface Feature {
  icon: 'globe' | 'grid' | 'bell' | 'chart';
  title: string;
  desc: string;
}

interface Step {
  n: string;
  title: string;
  desc: string;
}

/** Fila del mock de agenda: una cancha y el estado de sus franjas. */
interface AgendaRow {
  cancha: string;
  /** true = ocupado, false = libre, para cada hora de `agendaHours`. */
  cells: boolean[];
}

@Component({
  selector: 'app-marketing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MarcaDemoComponent],
  templateUrl: './marketing.html',
  styleUrl: './marketing.scss',
})
export class MarketingLanding {
  // ── Navegación ───────────────────────────────────────────────────
  readonly navLinks = [
    { label: 'Producto', href: '#producto' },
    { label: 'Tu marca', href: '#tu-marca' },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Contacto', href: '#contacto' },
  ];

  readonly heroFeatures = [
    'Fácil de usar',
    'Casi auto-gestionado',
    'Reservas online',
  ];

  // ── Producto: mock de agenda ─────────────────────────────────────
  readonly agendaHours = ['18:00', '19:00', '20:00', '21:00'];
  readonly agenda: AgendaRow[] = [
    { cancha: 'Cancha 1', cells: [true, true, false, true] },
    { cancha: 'Cancha 2', cells: [true, false, true, true] },
    { cancha: 'Cancha 3', cells: [false, true, true, false] },
    { cancha: 'Cancha 4', cells: [true, true, true, false] },
  ];

  // ── Producto: features ───────────────────────────────────────────
  readonly features: Feature[] = [
    {
      icon: 'globe',
      title: 'Reservas online 24/7',
      desc: 'Tus jugadores reservan su cancha desde el celular, a cualquier hora, sin que tengas que contestar.',
    },
    {
      icon: 'grid',
      title: 'Agenda por cancha',
      desc: 'Todas tus canchas y horarios en una sola grilla. De un vistazo sabés qué está ocupado y qué está libre.',
    },
    {
      icon: 'bell',
      title: 'Contacto directo',
      desc: 'Cada reserva llega con el WhatsApp del cliente a mano: le escribís vos, sin intermediarios.',
    },
    {
      icon: 'chart',
      title: 'Tu marca, tu página',
      desc: 'Cada club tiene su propia página de reservas, con su nombre, su logo y su color.',
    },
  ];

  // ── Cómo funciona ────────────────────────────────────────────────
  readonly steps: Step[] = [
    {
      n: '01',
      title: 'Cargás tus canchas',
      desc: 'Definís cuántas canchas tenés, tus horarios y la duración de cada turno. Una vez.',
    },
    {
      n: '02',
      title: 'Compartís tu link',
      desc: 'Te damos un link de reservas para tu Instagram, WhatsApp o web. Tus jugadores entran y reservan.',
    },
    {
      n: '03',
      title: 'Mirás el panel',
      desc: 'Ves todos los turnos en tiempo real desde una pantalla. Confirmás, movés o liberás en un toque.',
    },
  ];

  // ── Contacto: WhatsApp directo ───────────────────────────────────
  /** wa.me al número del club, con mensaje pre-cargado para pedir info. */
  readonly whatsappUrl =
    'https://wa.me/5493517505281?text=' +
    encodeURIComponent(
      '¡Hola! Me interesa Padel-HUB para mi club. ¿Me pasás más información? 🎾'
    );

  readonly anio = 2026;

  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    // La página arranca scrolleada al hero: el top-bar queda apenas arriba,
    // y se ve scrolleando un poquito hacia arriba.
    afterNextRender(() => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      const nav = this.host.nativeElement.querySelector(
        '.nav'
      ) as HTMLElement | null;
      window.scrollTo(0, nav?.offsetHeight ?? 0);
    });
  }

  // ── Hero: tilt 3D con el mouse ───────────────────────────────────
  readonly tiltX = signal(0);
  readonly tiltY = signal(0);

  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly paletaTransform = computed(
    () => `rotateX(${this.tiltX()}deg) rotateY(${this.tiltY()}deg) rotate(14deg)`
  );

  onHeroMove(ev: PointerEvent): void {
    if (this.reduceMotion || ev.pointerType !== 'mouse') return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = (ev.clientX - r.left) / r.width - 0.5;
    const ny = (ev.clientY - r.top) / r.height - 0.5;
    const RANGE = 8;
    this.tiltY.set(+(nx * RANGE).toFixed(2));
    this.tiltX.set(+(-ny * RANGE).toFixed(2));
  }

  onHeroLeave(): void {
    this.tiltX.set(0);
    this.tiltY.set(0);
  }

  /** Los anchors de solo-fragmento se resuelven contra <base href="/"> y se llevan puesto el
   *  query string (rompe UTMs de campaña, por ejemplo). Scrolleamos a mano y dejamos la URL como
   *  está. Mismo patrón que Landing.irA (ver landing.ts). */
  irA(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
