import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Hoja inferior con título y, si se pide, un buscador. El contenido va adentro. */
@Component({
  selector: 'qt-hoja',
  imports: [FormsModule],
  template: `
    <div class="velo" (click)="cerrar.emit()"></div>
    <div class="hoja" role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
      <div class="cabeza">
        <div class="agarre"></div>
        <div class="titulo">{{ titulo() }}</div>
        @if (buscador()) {
          <input
            class="input input-search"
            type="search"
            [placeholder]="placeholder()"
            [(ngModel)]="busqueda"
            autocomplete="off"
          />
        }
      </div>
      <div class="cuerpo">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .velo {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 44;
    }
    .hoja {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: var(--app-max);
      max-height: 82vh;
      overflow-y: auto;
      background: var(--white);
      border-radius: 22px 22px 0 0;
      z-index: 45;
      animation: qtUp 0.2s ease-out;
    }
    .cabeza {
      position: sticky;
      top: 0;
      background: var(--white);
      padding: 18px 16px 12px;
      border-bottom: 1px solid var(--border-default);
      z-index: 1;
    }
    .agarre {
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: var(--gray-300);
      margin: 0 auto 14px;
    }
    .titulo {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: 0.01em;
    }
    .cabeza .input {
      margin-top: 12px;
    }
    .cuerpo {
      padding: 12px 16px calc(24px + var(--safe-bottom));
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
})
export class HojaComponent {
  readonly titulo = input.required<string>();
  readonly buscador = input(false);
  readonly placeholder = input('Buscar');
  readonly busqueda = model('');
  readonly cerrar = output<void>();
}
