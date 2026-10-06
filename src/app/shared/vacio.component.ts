import { Component, input } from '@angular/core';

/** Estado vacío de una lista. */
@Component({
  selector: 'qt-vacio',
  template: `
    <div class="empty">
      <div class="empty-title">{{ titulo() }}</div>
      @if (texto()) {
        <div class="empty-text">{{ texto() }}</div>
      }
      <ng-content />
    </div>
  `,
})
export class VacioComponent {
  readonly titulo = input.required<string>();
  readonly texto = input('');
}

/** Estado de carga. */
@Component({
  selector: 'qt-cargando',
  template: `
    <div class="empty" aria-busy="true">
      <div class="rueda"></div>
      <div class="empty-text">Cargando…</div>
    </div>
  `,
  styles: `
    .rueda {
      width: 32px;
      height: 32px;
      margin: 0 auto;
      border-radius: 50%;
      border: 3px solid var(--gray-200);
      border-top-color: var(--red-600);
      animation: girar 0.8s linear infinite;
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class CargandoComponent {}

/** Estado de error. */
@Component({
  selector: 'qt-error',
  template: `<div class="error-box" role="alert">{{ texto() }}</div>`,
})
export class ErrorComponent {
  readonly texto = input.required<string>();
}
