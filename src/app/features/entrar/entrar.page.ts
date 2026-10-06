import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { db, vivo } from '../../core/db';
import type { Persona } from '../../core/models';
import { ROL_LABEL, SesionService } from '../../core/sesion.service';
import { TecladoPinComponent } from '../../shared/teclado-pin.component';
import { CargandoComponent, ErrorComponent } from '../../shared/vacio.component';

/** Escoger quién va a usar el celular y escribir su PIN. */
@Component({
  selector: 'qt-entrar',
  imports: [TecladoPinComponent, CargandoComponent, ErrorComponent],
  template: `
    <header class="marca">
      @if (elegida() && personas.valor().length > 1) {
        <button type="button" class="atras" aria-label="Escoger otra persona" (click)="escogida.set(null)">‹</button>
      }
      <div class="logo">{{ nombreTaller() }}</div>
    </header>

    <div class="page">
      @if (personas.error(); as e) {
        <qt-error [texto]="e" />
      } @else if (personas.cargando()) {
        <qt-cargando />
      } @else if (elegida(); as p) {
        <div class="saludo">
          <div class="avatar grande">{{ p.nombre.charAt(0).toUpperCase() }}</div>
          <div class="hola">Hola, {{ p.nombre.split(' ')[0] }}</div>
          <div class="muted">{{ roles[p.rol] }} · escribe tu PIN</div>
          @if (fallo()) {
            <div class="mal">PIN incorrecto. Intenta otra vez.</div>
          }
        </div>
        <qt-teclado-pin [error]="fallo()" (completo)="probar(p, $event)" />
      } @else {
        <div class="section-title primero">¿Quién va a trabajar?</div>
        <div class="stack">
          @for (p of personas.valor(); track p.id) {
            <button type="button" class="choice" (click)="elegir(p)">
              <div class="avatar">{{ p.nombre.charAt(0).toUpperCase() }}</div>
              <div class="grow">
                <div class="nombre">{{ p.nombre }}</div>
                <div class="muted">{{ roles[p.rol] }}</div>
              </div>
              <span class="flecha">›</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .marca {
      background: var(--black);
      color: var(--white);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      padding-top: calc(14px + env(safe-area-inset-top, 0px));
      min-height: var(--header-h);
    }
    .logo {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .atras {
      width: 40px;
      height: 40px;
      margin-left: -8px;
      background: transparent;
      border: 0;
      color: var(--white);
      font-size: 30px;
      line-height: 1;
    }
    .primero {
      margin-top: 8px;
    }
    .nombre {
      font-size: 16px;
      font-weight: 600;
    }
    .flecha {
      font-size: 22px;
      color: var(--gray-300);
    }
    .saludo {
      text-align: center;
      padding: 12px 0 8px;
    }
    .avatar.grande {
      width: 64px;
      height: 64px;
      margin: 0 auto 12px;
      font-size: 26px;
      background: var(--zinc-900);
      color: var(--white);
      font-family: var(--font-display);
    }
    .hola {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 28px;
      text-transform: uppercase;
    }
    .mal {
      color: var(--red-700);
      font-weight: 600;
      margin-top: 8px;
    }
  `,
})
export class EntrarPage {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected readonly roles = ROL_LABEL;
  protected readonly personas = vivo(() => db.personas.filter((p) => p.activo).toArray(), [] as Persona[]);
  private readonly taller = vivo(() => db.taller.get('taller'), undefined);
  protected readonly nombreTaller = computed(() => this.taller.valor()?.nombre ?? 'QualityTaller');

  protected readonly escogida = signal<Persona | null>(null);
  /** Con una sola persona no hay nada que escoger. */
  protected readonly elegida = computed(() => {
    const l = this.personas.valor();
    return this.escogida() ?? (l.length === 1 ? l[0] : null);
  });
  protected readonly fallo = signal(false);

  constructor() {
    this.sesion.salir();
  }

  elegir(p: Persona): void {
    this.fallo.set(false);
    this.escogida.set(p);
  }

  async probar(p: Persona, pin: string): Promise<void> {
    if (await this.sesion.entrar(p.id, pin)) {
      this.router.navigateByUrl('/');
      return;
    }
    this.fallo.set(false);
    queueMicrotask(() => this.fallo.set(true));
  }
}
