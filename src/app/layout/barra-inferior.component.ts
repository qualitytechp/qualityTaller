import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Barra de 5 pestañas: Inicio · Órdenes · Recibir (botón rojo central) · Clientes · Más.
 * El mecánico ve otra: Mis trabajos · Repuestos · Mi perfil.
 */
@Component({
  selector: 'qt-barra-inferior',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="barra" aria-label="Navegación principal">
      @if (tipo() === 'principal') {
        <a routerLink="/inicio" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
          <span>Inicio</span>
        </a>
        <a routerLink="/ordenes" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg>
          <span>Órdenes</span>
        </a>
        <a routerLink="/recibir" class="tab recibir">
          <div class="mas">+</div>
          <span>Recibir</span>
        </a>
        <a routerLink="/clientes" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"></path></svg>
          <span>Clientes</span>
        </a>
        <a routerLink="/mas" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
          <span>Más</span>
        </a>
      } @else {
        <a routerLink="/mis-trabajos" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg>
          <span>Mis trabajos</span>
        </a>
        <a routerLink="/repuestos" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path></svg>
          <span>Repuestos</span>
        </a>
        <a routerLink="/perfil" routerLinkActive="on" class="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"></path></svg>
          <span>Mi perfil</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .barra {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: var(--app-max);
      height: calc(var(--tabbar-h) + var(--safe-bottom));
      padding-bottom: var(--safe-bottom);
      background: var(--white);
      border-top: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      z-index: 28;
    }
    .tab {
      flex: 1;
      height: var(--tabbar-h);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--gray-400);
      font-size: 11.5px;
      font-weight: 600;
    }
    .tab.on {
      color: var(--red-600);
      font-weight: 700;
    }
    svg {
      width: 24px;
      height: 24px;
    }
    .recibir {
      gap: 3px;
      color: var(--red-600);
      font-weight: 700;
    }
    .mas {
      width: 58px;
      height: 58px;
      margin-top: -26px;
      border-radius: 50%;
      background: var(--red-600);
      color: var(--white);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(217, 43, 18, 0.45);
      font-size: 34px;
      font-weight: 300;
      line-height: 1;
    }
  `,
})
export class BarraInferiorComponent {
  readonly tipo = input<'principal' | 'mecanico'>('principal');
}
