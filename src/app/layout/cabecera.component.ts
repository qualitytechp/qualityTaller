import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { ROL_LABEL, SesionService } from '../core/sesion.service';

@Component({
  selector: 'qt-cabecera',
  template: `
    <header class="cabecera">
      @if (atras()) {
        <button type="button" class="atras" aria-label="Volver" (click)="volver.emit()">‹</button>
      }
      @if (logo()) {
        <div class="logo">Quality<span>Taller</span></div>
      } @else {
        <div class="titulo">{{ titulo() }}</div>
      }
      @if (sesion.persona(); as p) {
        <button type="button" class="rol" (click)="cambiar()" title="Tocar para cambiar de persona">
          {{ etiquetas[p.rol] }}
        </button>
      }
    </header>
  `,
  styles: `
    .cabecera {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--black);
      color: var(--white);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      padding-top: calc(14px + env(safe-area-inset-top, 0px));
      min-height: var(--header-h);
    }
    .atras {
      width: 40px;
      height: 40px;
      margin-left: -8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0;
      color: var(--white);
      font-size: 30px;
      line-height: 1;
    }
    .logo,
    .titulo {
      flex: 1;
      min-width: 0;
      font-family: var(--font-display);
      text-transform: uppercase;
    }
    .logo {
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 0.02em;
    }
    .logo span {
      color: var(--red-600);
    }
    .titulo {
      font-weight: 700;
      font-size: 21px;
      letter-spacing: 0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rol {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--zinc-400);
      background: transparent;
      border: 1px solid var(--zinc-700);
      border-radius: 999px;
      padding: 5px 10px;
      min-height: 32px;
      white-space: nowrap;
    }
  `,
})
export class CabeceraComponent {
  readonly titulo = input('');
  readonly logo = input(false);
  readonly atras = input(false);
  readonly volver = output<void>();

  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  protected readonly etiquetas = ROL_LABEL;

  cambiar(): void {
    this.router.navigateByUrl('/entrar');
  }
}
